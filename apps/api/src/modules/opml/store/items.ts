import { createHash } from "node:crypto";
import { and, count, eq, gt, inArray, lt, notInArray, or, sql } from "drizzle-orm";
import { opmlImportItems, opmlImports } from "@kyomi/db";
import type { db } from "@adapters/db/client";
import { AppError } from "@shared/errors/app";
import {
  OPML_ITEM_HEARTBEAT_MS,
  OPML_ITEM_LEASE_MS,
  OPML_ITEM_MAX_ATTEMPTS,
  OPML_MATERIALIZE_CHUNK_SIZE,
} from "../constants";
import { decodeOpmlFailureCursor, encodeOpmlFailureCursor } from "../failure-cursor";
import type { ParsedOpmlFeed } from "../types";

const OPML_FAILURE_PAGE_DEFAULT_LIMIT = 50;
const OPML_FAILURE_PAGE_MAX_LIMIT = 100;

const NONTERMINAL_PARENT_STATUSES = ["dispatching", "running"] as const;

type DB = typeof db;

function rowsFromExecute<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function opmlImportItemId(importId: string, normalizedUrl: string): string {
  const digest = createHash("sha256")
    .update(importId)
    .update("\u0000")
    .update(normalizedUrl)
    .digest("hex");
  return `${importId}:${digest}`;
}

/**
 * Writes at most OPML_MATERIALIZE_CHUNK_SIZE rows per statement, using onConflictDoNothing on
 * (importId, normalizedUrl) so a crash-and-resume reparse never duplicates items.
 */
export async function insertOpmlImportItems(
  database: DB,
  importId: string,
  feeds: ParsedOpmlFeed[],
  folderMap: Map<string, string>,
): Promise<number> {
  if (feeds.length === 0) {
    return 0;
  }

  const now = new Date();
  for (const [batchIndex, batch] of chunk(feeds, OPML_MATERIALIZE_CHUNK_SIZE).entries()) {
    const startPosition = batchIndex * OPML_MATERIALIZE_CHUNK_SIZE;
    await database
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
      .onConflictDoNothing();
  }

  return countOpmlImportItems(database, importId);
}

export async function countOpmlImportItems(database: DB, importId: string): Promise<number> {
  const [row] = await database
    .select({ total: count() })
    .from(opmlImportItems)
    .where(eq(opmlImportItems.importId, importId));
  return row?.total ?? 0;
}

export type ClaimDispatchableOpmlItemsOptions = {
  maxImports: number;
  perImport: number;
  total: number;
  leaseMs: number;
};

export type ClaimedOpmlItem = {
  id: string;
  importId: string;
  position: number;
  originalUrl: string;
  normalizedUrl: string;
  title: string | null;
  folderName: string;
  folderId: string | null;
  feedId: string | null;
  leaseToken: string;
  attempts: number;
};

/**
 * Fairly leases at most `options.perImport` pending items per active import, capped at
 * `options.total` overall and `options.maxImports` distinct imports per call. Uses
 * FOR UPDATE SKIP LOCKED at both the import and item level so concurrent dispatcher replicas
 * never claim the same row twice, and Postgres 18's gen_random_uuid for a distinct lease token
 * per item (never shared across items).
 */
export async function claimDispatchableOpmlItems(
  database: DB,
  now: Date,
  options: ClaimDispatchableOpmlItemsOptions,
): Promise<ClaimedOpmlItem[]> {
  const leaseExpiresAt = new Date(now.getTime() + options.leaseMs);
  const result = await database.execute(sql<ClaimedOpmlItem>`
    WITH active_imports AS (
      SELECT id
      FROM ${opmlImports}
      WHERE status IN ('dispatching', 'running')
      ORDER BY created_at, id
      FOR UPDATE SKIP LOCKED
      LIMIT ${options.maxImports}
    ),
    candidate_items AS (
      SELECT candidate.id
      FROM active_imports
      CROSS JOIN LATERAL (
        SELECT item.id
        FROM ${opmlImportItems} item
        WHERE item.import_id = active_imports.id
          AND item.status = 'pending'
          AND item.available_at <= ${now}
        ORDER BY item.position, item.id
        FOR UPDATE SKIP LOCKED
        LIMIT ${options.perImport}
      ) candidate
    ),
    claimed AS (
      UPDATE ${opmlImportItems} item
      SET status = 'leased',
          lease_token = gen_random_uuid()::text,
          lease_expires_at = ${leaseExpiresAt},
          attempts = item.attempts + 1,
          updated_at = ${now}
      FROM candidate_items candidate
      WHERE item.id = candidate.id
      RETURNING item.*
    )
    SELECT
      id,
      import_id AS "importId",
      position,
      original_url AS "originalUrl",
      normalized_url AS "normalizedUrl",
      title,
      folder_name AS "folderName",
      folder_id AS "folderId",
      feed_id AS "feedId",
      lease_token AS "leaseToken",
      attempts
    FROM claimed
    ORDER BY import_id, position, id
    LIMIT ${options.total}
  `);

  return rowsFromExecute<ClaimedOpmlItem>(result);
}

/**
 * Conditionally returns a leased item to pending only if it is still leased under the given
 * token, so a stale/duplicate release can never clobber a newer claim. Returns whether a row
 * was updated.
 */
export async function releaseOpmlItemLease(
  database: DB,
  itemId: string,
  leaseToken: string,
  availableAt: Date,
): Promise<boolean> {
  const updated = await database
    .update(opmlImportItems)
    .set({
      status: "pending",
      leaseToken: null,
      leaseExpiresAt: null,
      availableAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(opmlImportItems.id, itemId),
        eq(opmlImportItems.status, "leased"),
        eq(opmlImportItems.leaseToken, leaseToken),
      ),
    )
    .returning({ id: opmlImportItems.id });
  return updated.length > 0;
}

/** Transitions the parent import from dispatching to running on the first leased item. */
export async function markOpmlImportRunning(database: DB, importId: string): Promise<void> {
  await database
    .update(opmlImports)
    .set({ status: "running", updatedAt: new Date() })
    .where(and(eq(opmlImports.id, importId), eq(opmlImports.status, "dispatching")));
}

export type ClaimedLeasedOpmlItem = {
  id: string;
  importId: string;
  userId: string;
  originalUrl: string;
  normalizedUrl: string;
  title: string | null;
  folderName: string;
  folderId: string | null;
  feedId: string | null;
  leaseToken: string;
  attempts: number;
};

/**
 * Guarded leased -> processing claim: only succeeds when id/importId/leaseToken all match and
 * the parent import is not cancelling or cancelled. Extends the lease by OPML_ITEM_LEASE_MS so
 * the worker has a fresh window to do its network/database work. Returns null for a stale or
 * already-claimed duplicate wakeup.
 */
export async function claimLeasedOpmlItem(
  database: DB,
  importId: string,
  itemId: string,
  leaseToken: string,
): Promise<ClaimedLeasedOpmlItem | null> {
  const now = new Date();
  const [claimed] = await database
    .update(opmlImportItems)
    .set({
      status: "processing",
      leaseExpiresAt: new Date(now.getTime() + OPML_ITEM_LEASE_MS),
      updatedAt: now,
    })
    .where(
      and(
        eq(opmlImportItems.id, itemId),
        eq(opmlImportItems.importId, importId),
        eq(opmlImportItems.leaseToken, leaseToken),
        eq(opmlImportItems.status, "leased"),
        sql`EXISTS (
          SELECT 1 FROM ${opmlImports}
          WHERE ${opmlImports.id} = ${importId}
            AND ${opmlImports.status} NOT IN ('cancelling', 'cancelled')
        )`,
      ),
    )
    .returning();

  if (!claimed) {
    return null;
  }
  const [parent] = await database
    .select({ userId: opmlImports.userId })
    .from(opmlImports)
    .where(eq(opmlImports.id, importId))
    .limit(1);
  if (!parent) {
    throw new Error(`OPML import ${importId} not found after claiming one of its items`);
  }
  return {
    id: claimed.id,
    importId: claimed.importId,
    userId: parent.userId,
    originalUrl: claimed.originalUrl,
    normalizedUrl: claimed.normalizedUrl,
    title: claimed.title,
    folderName: claimed.folderName,
    folderId: claimed.folderId,
    feedId: claimed.feedId,
    leaseToken: claimed.leaseToken as string,
    attempts: claimed.attempts,
  };
}

/**
 * Extends the item's heartbeat and lease expiry every OPML_ITEM_HEARTBEAT_MS while `task` runs,
 * only while status/id/token still match (a stale heartbeat after the item moved on is a no-op).
 * Always clears its timer, even if `task` throws.
 */
export async function withOpmlItemLeaseHeartbeat<T>(
  database: DB,
  claim: ClaimedLeasedOpmlItem,
  task: () => Promise<T>,
): Promise<T> {
  const timer = setInterval(() => {
    void database
      .update(opmlImportItems)
      .set({
        leaseExpiresAt: new Date(Date.now() + OPML_ITEM_LEASE_MS),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(opmlImportItems.id, claim.id),
          eq(opmlImportItems.status, "processing"),
          eq(opmlImportItems.leaseToken, claim.leaseToken),
        ),
      );
  }, OPML_ITEM_HEARTBEAT_MS);

  try {
    return await task();
  } finally {
    clearInterval(timer);
  }
}

type OpmlItemOutcome = "subscribed" | "already_subscribed";

/**
 * Guarded processing -> terminal transition. Duplicate completion (already terminal) updates
 * zero rows and returns false without incrementing any counter twice. Parent finalization
 * (accounted_items === total_items) excludes cancelling/cancelled parents.
 */
export async function completeOpmlItem(
  database: DB,
  claim: { id: string; importId: string; leaseToken: string },
  outcome: OpmlItemOutcome,
): Promise<boolean> {
  return database.transaction(async (tx) => {
    const now = new Date();
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

    if (outcome === "subscribed") {
      await tx
        .update(opmlImports)
        .set({
          completedItems: sql`${opmlImports.completedItems} + 1`,
          subscribedItems: sql`${opmlImports.subscribedItems} + 1`,
          updatedAt: now,
        })
        .where(eq(opmlImports.id, claim.importId));
    } else {
      await tx
        .update(opmlImports)
        .set({
          completedItems: sql`${opmlImports.completedItems} + 1`,
          alreadySubscribedItems: sql`${opmlImports.alreadySubscribedItems} + 1`,
          updatedAt: now,
        })
        .where(eq(opmlImports.id, claim.importId));
    }

    await finalizeIfAccountedForAll(tx as never, claim.importId, now);
    return true;
  });
}

const RECLAIMABLE_ITEM_STATUSES = ["leased", "processing"] as const;

/**
 * Retryable failures before the max-attempts threshold return the item to pending with a
 * cleared token and a backoff-delayed availableAt. Permanent errors or the final attempt
 * transition to failed and increment the parent's failedItems/completedItems exactly once.
 * Matches either leased (never claimed, expired before a worker picked it up) or processing
 * (claimed, then abandoned or failed) so the reconciler can reuse this for expired-lease
 * recovery without duplicating the attempt-based decision.
 */
export async function retryOrFailOpmlItem(
  database: DB,
  claim: { id: string; importId: string; leaseToken: string; attempts: number },
  decision: { retryable: boolean; code: string; message: string },
  availableAt: Date,
): Promise<void> {
  const isFinalAttempt = claim.attempts >= OPML_ITEM_MAX_ATTEMPTS;

  if (decision.retryable && !isFinalAttempt) {
    await database
      .update(opmlImportItems)
      .set({
        status: "pending",
        leaseToken: null,
        leaseExpiresAt: null,
        availableAt,
        errorCode: decision.code,
        errorMessage: decision.message,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(opmlImportItems.id, claim.id),
          eq(opmlImportItems.importId, claim.importId),
          eq(opmlImportItems.leaseToken, claim.leaseToken),
          inArray(opmlImportItems.status, RECLAIMABLE_ITEM_STATUSES),
        ),
      );
    return;
  }

  await database.transaction(async (tx) => {
    const now = new Date();
    const [transitioned] = await tx
      .update(opmlImportItems)
      .set({
        status: "failed",
        errorCode: decision.code,
        errorMessage: decision.message,
        outcomeAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(opmlImportItems.id, claim.id),
          eq(opmlImportItems.importId, claim.importId),
          eq(opmlImportItems.leaseToken, claim.leaseToken),
          inArray(opmlImportItems.status, RECLAIMABLE_ITEM_STATUSES),
        ),
      )
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

    await finalizeIfAccountedForAll(tx as never, claim.importId, now);
  });
}

async function finalizeIfAccountedForAll(database: DB, importId: string, now: Date): Promise<void> {
  const [row] = await database
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

  await database
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
export async function cancelPendingOpmlItems(
  database: DB,
  importId: string,
  batchSize: number,
): Promise<number> {
  const limit = Math.min(Math.max(1, batchSize), CANCEL_BATCH_MAX);
  return database.transaction(async (tx) => {
    const now = new Date();
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
    const count = rowsFromExecute<{ id: string }>(cancelled).length;
    if (count === 0) {
      return 0;
    }

    await tx
      .update(opmlImports)
      .set({ cancelledItems: sql`${opmlImports.cancelledItems} + ${count}`, updatedAt: now })
      .where(eq(opmlImports.id, importId));

    await finalizeIfCancelled(tx as never, importId, now);
    return count;
  });
}

async function finalizeIfCancelled(database: DB, importId: string, now: Date): Promise<void> {
  const [row] = await database
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

  await database
    .update(opmlImports)
    .set({ status: "cancelled", completedAt: now, updatedAt: now })
    .where(and(eq(opmlImports.id, importId), eq(opmlImports.status, "cancelling")));
}

export type OpmlFailureItem = {
  id: string;
  url: string;
  code: string;
  message: string;
  position: number;
};

export type ListOpmlImportFailuresInput = {
  userId: string;
  importId: string;
  limit?: number;
  cursor?: string;
};

export type OpmlFailurePage = {
  items: OpmlFailureItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

function normalizeOpmlFailureLimit(limit: number | undefined): number {
  return Math.min(
    Math.max(1, limit ?? OPML_FAILURE_PAGE_DEFAULT_LIMIT),
    OPML_FAILURE_PAGE_MAX_LIMIT,
  );
}

/**
 * Keyset-paginates failed items for one user-owned import, ordered ascending by
 * (position, id) using the opml_import_items_failure_page_idx index. Invalid cursors throw
 * AppError OPML_FAILURE_CURSOR_INVALID rather than silently restarting from the beginning.
 */
export async function listOpmlImportFailures(
  database: DB,
  input: ListOpmlImportFailuresInput,
): Promise<OpmlFailurePage> {
  const limit = normalizeOpmlFailureLimit(input.limit);
  let cursor: { position: number; id: string } | null = null;
  if (input.cursor !== undefined) {
    cursor = decodeOpmlFailureCursor(input.cursor);
    if (!cursor) {
      throw new AppError("Invalid failure cursor", {
        status: 400,
        code: "OPML_FAILURE_CURSOR_INVALID",
      });
    }
  }

  const ownerRow = await database
    .select({ id: opmlImports.id })
    .from(opmlImports)
    .where(and(eq(opmlImports.id, input.importId), eq(opmlImports.userId, input.userId)))
    .limit(1);
  if (ownerRow.length === 0) {
    return { items: [], nextCursor: null, hasMore: false };
  }

  const boundary = cursor
    ? or(
        gt(opmlImportItems.position, cursor.position),
        and(eq(opmlImportItems.position, cursor.position), gt(opmlImportItems.id, cursor.id)),
      )
    : undefined;

  const rows = await database
    .select({
      id: opmlImportItems.id,
      url: opmlImportItems.normalizedUrl,
      code: opmlImportItems.errorCode,
      message: opmlImportItems.errorMessage,
      position: opmlImportItems.position,
    })
    .from(opmlImportItems)
    .where(
      and(
        eq(opmlImportItems.importId, input.importId),
        eq(opmlImportItems.status, "failed"),
        boundary,
      ),
    )
    .orderBy(opmlImportItems.position, opmlImportItems.id)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page.map((row) => ({
      id: row.id,
      url: row.url,
      code: row.code ?? "",
      message: row.message ?? "",
      position: row.position,
    })),
    nextCursor:
      hasMore && last ? encodeOpmlFailureCursor({ position: last.position, id: last.id }) : null,
    hasMore,
  };
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
export async function findExpiredOpmlLeases(
  database: DB,
  now: Date,
): Promise<ExpiredOpmlLeaseItem[]> {
  const rows = await database
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
    .limit(RECONCILE_EXPIRED_LEASE_BATCH);

  return rows
    .filter((row): row is ExpiredOpmlLeaseItem => row.leaseToken !== null)
    .map((row) => ({
      id: row.id,
      importId: row.importId,
      leaseToken: row.leaseToken,
      attempts: row.attempts,
    }));
}
