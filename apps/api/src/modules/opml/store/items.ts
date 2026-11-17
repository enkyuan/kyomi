import { createHash } from "node:crypto";
import { Array as Arr, DateTime, Effect } from "effect";
import { and, count, eq, inArray, lt, notInArray, sql } from "drizzle-orm";
import { opmlImportItems, opmlImports } from "@kyomi/db";
import { Db } from "@adapters/db/service";
import { rowsFromExecute } from "@shared/db/rows";
import { OPML_ITEM_MAX_ATTEMPTS, OPML_MATERIALIZE_CHUNK_SIZE } from "../constants";
import type { ParsedOpmlFeed } from "../types";
import type { SqlClient } from "./sql";

const NONTERMINAL_PARENT_STATUSES = ["dispatching", "running"] as const;

const RECLAIMABLE_ITEM_STATUSES = ["leased", "processing"] as const;

export function opmlImportItemId(importId: string, normalizedUrl: string): string {
  const digest = createHash("sha256")
    .update(importId)
    .update("\u0000")
    .update(normalizedUrl)
    .digest("hex");
  return `${importId}:${digest}`;
}

export const countOpmlImportItems = Effect.fn("opml.store.count_items")(function* (
  importId: string,
) {
  const db = yield* Db;
  const [row] = yield* db.use("opml.item.count", (client) =>
    client
      .select({ total: count() })
      .from(opmlImportItems)
      .where(eq(opmlImportItems.importId, importId)),
  );
  return row?.total ?? 0;
});

/**
 * Writes at most OPML_MATERIALIZE_CHUNK_SIZE rows per statement, using onConflictDoNothing on
 * (importId, normalizedUrl) so a crash-and-resume reparse never duplicates items.
 */
export const insertOpmlImportItems = Effect.fn("opml.store.insert_items")(function* (
  importId: string,
  feeds: ParsedOpmlFeed[],
  folderMap: Map<string, string>,
) {
  if (feeds.length === 0) {
    return 0;
  }

  const db = yield* Db;
  const now = yield* DateTime.nowAsDate;
  for (const [batchIndex, batch] of Arr.chunksOf(feeds, OPML_MATERIALIZE_CHUNK_SIZE).entries()) {
    const startPosition = batchIndex * OPML_MATERIALIZE_CHUNK_SIZE;
    yield* db.use("opml.item.insert", (client) =>
      client
        .insert(opmlImportItems)
        .values(
          batch.map((feed, offset) => ({
            id: opmlImportItemId(importId, feed.normalizedUrl),
            importId,
            position: startPosition + offset,
            originalUrl: feed.originalUrl,
            normalizedUrl: feed.normalizedUrl,
            title: feed.title,
            folderName: feed.folderName,
            folderId: folderMap.get(feed.folderName) ?? null,
            status: "pending",
            availableAt: now,
            createdAt: now,
            updatedAt: now,
          })),
        )
        .onConflictDoNothing(),
    );
  }

  return yield* countOpmlImportItems(importId);
});

type OpmlItemOutcome = "subscribed" | "already_subscribed";

/**
 * Guarded processing -> terminal transition. Duplicate completion (already terminal) updates
 * zero rows and returns false without incrementing any counter twice. Parent finalization
 * (accounted_items === total_items) excludes cancelling/cancelled parents.
 */
export const completeOpmlItem = Effect.fn("opml.store.complete_item")(function* (
  claim: { id: string; importId: string; leaseToken: string },
  outcome: OpmlItemOutcome,
) {
  const db = yield* Db;
  const now = yield* DateTime.nowAsDate;
  return yield* db.use("opml.item.complete", (client) =>
    client.transaction(async (tx) => {
      const [transitioned] = await tx
        .update(opmlImportItems)
        .set({ status: outcome, outcomeAt: now, updatedAt: now })
        .where(
          and(
            eq(opmlImportItems.id, claim.id),
            eq(opmlImportItems.importId, claim.importId),
            eq(opmlImportItems.leaseToken, claim.leaseToken),
            eq(opmlImportItems.status, "processing"),
            sql`EXISTS (
              SELECT 1 FROM ${opmlImports}
              WHERE ${opmlImports.id} = ${claim.importId}
                AND ${opmlImports.status} NOT IN ('cancelling', 'cancelled')
            )`,
          ),
        )
        .returning({ id: opmlImportItems.id });
      if (!transitioned) {
        return false;
      }

      await tx
        .update(opmlImports)
        .set({
          completedItems: sql`${opmlImports.completedItems} + 1`,
          ...(outcome === "subscribed"
            ? { subscribedItems: sql`${opmlImports.subscribedItems} + 1` }
            : { alreadySubscribedItems: sql`${opmlImports.alreadySubscribedItems} + 1` }),
          updatedAt: now,
        })
        .where(eq(opmlImports.id, claim.importId));

      await finalizeIfAccountedForAll(tx, claim.importId, now);
      return true;
    }),
  );
});

/**
 * Retryable failures before the max-attempts threshold return the item to pending with a
 * cleared token and a backoff-delayed availableAt. Permanent errors or the final attempt
 * transition to failed and increment the parent's failedItems/completedItems exactly once.
 * Matches either leased (never claimed, expired before a worker picked it up) or processing
 * (claimed, then abandoned or failed) so the reconciler can reuse this for expired-lease
 * recovery without duplicating the attempt-based decision.
 */
export const retryOrFailOpmlItem = Effect.fn("opml.store.retry_or_fail_item")(function* (
  claim: { id: string; importId: string; leaseToken: string; attempts: number },
  decision: { retryable: boolean; code: string; message: string },
  availableAt: Date,
) {
  const db = yield* Db;
  const now = yield* DateTime.nowAsDate;
  const isFinalAttempt = claim.attempts >= OPML_ITEM_MAX_ATTEMPTS;
  const reclaimable = and(
    eq(opmlImportItems.id, claim.id),
    eq(opmlImportItems.importId, claim.importId),
    eq(opmlImportItems.leaseToken, claim.leaseToken),
    inArray(opmlImportItems.status, RECLAIMABLE_ITEM_STATUSES),
  );

  if (decision.retryable && !isFinalAttempt) {
    yield* db.use("opml.item.retry", (client) =>
      client
        .update(opmlImportItems)
        .set({
          status: "pending",
          leaseToken: null,
          leaseExpiresAt: null,
          availableAt,
          errorCode: decision.code,
          errorMessage: decision.message,
          updatedAt: now,
        })
        .where(reclaimable),
    );
    return;
  }

  yield* db.use("opml.item.fail", (client) =>
    client.transaction(async (tx) => {
      const [transitioned] = await tx
        .update(opmlImportItems)
        .set({
          status: "failed",
          errorCode: decision.code,
          errorMessage: decision.message,
          outcomeAt: now,
          updatedAt: now,
        })
        .where(reclaimable)
        .returning({ id: opmlImportItems.id });
      if (!transitioned) {
        return;
      }

      await tx
        .update(opmlImports)
        .set({
          completedItems: sql`${opmlImports.completedItems} + 1`,
          failedItems: sql`${opmlImports.failedItems} + 1`,
          updatedAt: now,
        })
        .where(eq(opmlImports.id, claim.importId));

      await finalizeIfAccountedForAll(tx, claim.importId, now);
    }),
  );
});

async function finalizeIfAccountedForAll(
  client: SqlClient,
  importId: string,
  now: Date,
): Promise<void> {
  const [row] = await client
    .select({
      totalItems: opmlImports.totalItems,
      subscribedItems: opmlImports.subscribedItems,
      alreadySubscribedItems: opmlImports.alreadySubscribedItems,
      failedItems: opmlImports.failedItems,
      cancelledItems: opmlImports.cancelledItems,
    })
    .from(opmlImports)
    .where(
      and(
        eq(opmlImports.id, importId),
        notInArray(opmlImports.status, ["cancelling", "cancelled"]),
      ),
    )
    .limit(1);
  if (!row) {
    return;
  }

  const accounted =
    row.subscribedItems + row.alreadySubscribedItems + row.failedItems + row.cancelledItems;
  if (accounted < row.totalItems) {
    return;
  }

  await client
    .update(opmlImports)
    .set({
      status: row.failedItems === row.totalItems && row.totalItems > 0 ? "failed" : "completed",
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(eq(opmlImports.id, importId), inArray(opmlImports.status, NONTERMINAL_PARENT_STATUSES)),
    );
}

const CANCEL_BATCH_MAX = 500;

/**
 * Cancels at most `batchSize` (capped at 500) pending/leased rows for one import using
 * FOR UPDATE SKIP LOCKED, so concurrent dispatcher or reconciler activity never double-counts a
 * row. Returns the number of rows cancelled in this call; callers loop until it returns 0.
 * Increments cancelledItems by exactly that count and finalizes the parent to cancelled once
 * every item is accounted for.
 */
export const cancelPendingOpmlItems = Effect.fn("opml.store.cancel_pending_items")(function* (
  importId: string,
  batchSize: number,
) {
  const db = yield* Db;
  const now = yield* DateTime.nowAsDate;
  const limit = Math.min(Math.max(1, batchSize), CANCEL_BATCH_MAX);
  return yield* db.use("opml.item.cancel_pending", (client) =>
    client.transaction(async (tx) => {
      const cancelled = await tx.execute(sql<{ id: string }>`
        WITH candidate AS (
          SELECT id
          FROM ${opmlImportItems}
          WHERE import_id = ${importId}
            AND status IN ('pending', 'leased')
          ORDER BY position, id
          FOR UPDATE SKIP LOCKED
          LIMIT ${limit}
        )
        UPDATE ${opmlImportItems} item
        SET status = 'cancelled',
            lease_token = NULL,
            lease_expires_at = NULL,
            outcome_at = ${now},
            updated_at = ${now}
        FROM candidate
        WHERE item.id = candidate.id
        RETURNING item.id
      `);
      const cancelledCount = rowsFromExecute<{ id: string }>(cancelled).length;
      if (cancelledCount === 0) {
        return 0;
      }

      await tx
        .update(opmlImports)
        .set({
          cancelledItems: sql`${opmlImports.cancelledItems} + ${cancelledCount}`,
          updatedAt: now,
        })
        .where(eq(opmlImports.id, importId));

      await finalizeIfCancelled(tx, importId, now);
      return cancelledCount;
    }),
  );
});

async function finalizeIfCancelled(client: SqlClient, importId: string, now: Date): Promise<void> {
  const [row] = await client
    .select({
      totalItems: opmlImports.totalItems,
      subscribedItems: opmlImports.subscribedItems,
      alreadySubscribedItems: opmlImports.alreadySubscribedItems,
      failedItems: opmlImports.failedItems,
      cancelledItems: opmlImports.cancelledItems,
    })
    .from(opmlImports)
    .where(and(eq(opmlImports.id, importId), eq(opmlImports.status, "cancelling")))
    .limit(1);
  if (!row) {
    return;
  }

  const accounted =
    row.subscribedItems + row.alreadySubscribedItems + row.failedItems + row.cancelledItems;
  if (accounted < row.totalItems) {
    return;
  }

  await client
    .update(opmlImports)
    .set({ status: "cancelled", completedAt: now, updatedAt: now })
    .where(and(eq(opmlImports.id, importId), eq(opmlImports.status, "cancelling")));
}

const RECONCILE_EXPIRED_LEASE_BATCH = 500;

export type ExpiredOpmlLeaseItem = {
  id: string;
  importId: string;
  leaseToken: string;
  attempts: number;
};

/**
 * Finds at most RECONCILE_EXPIRED_LEASE_BATCH leased/processing items whose lease has expired,
 * for the reconciler to feed into retryOrFailOpmlItem. Unexpired rows (a worker still holding
 * a live lease or heartbeat) are never touched.
 */
export const findExpiredOpmlLeases = Effect.fn("opml.store.find_expired_leases")(function* (
  now: Date,
) {
  const db = yield* Db;
  const rows = yield* db.use("opml.item.find_expired_leases", (client) =>
    client
      .select({
        id: opmlImportItems.id,
        importId: opmlImportItems.importId,
        leaseToken: opmlImportItems.leaseToken,
        attempts: opmlImportItems.attempts,
      })
      .from(opmlImportItems)
      .where(
        and(
          inArray(opmlImportItems.status, RECLAIMABLE_ITEM_STATUSES),
          lt(opmlImportItems.leaseExpiresAt, now),
        ),
      )
      .limit(RECONCILE_EXPIRED_LEASE_BATCH),
  );

  return rows
    .filter((row): row is ExpiredOpmlLeaseItem => row.leaseToken !== null)
    .map((row) => ({
      id: row.id,
      importId: row.importId,
      leaseToken: row.leaseToken,
      attempts: row.attempts,
    }));
});
