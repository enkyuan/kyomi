import { DateTime, Data, Effect } from "effect";
import { and, eq, sql } from "drizzle-orm";
import { opmlImportItems, opmlImports } from "@kyomi/db";
import { Db } from "@adapters/db/service";
import { AppLogger } from "@adapters/logger/service";
import { serializeError } from "@shared/errors/serialize";
import { OPML_ITEM_HEARTBEAT_MS, OPML_ITEM_LEASE_MS } from "../constants";
import { rowsFromExecute } from "./sql";

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
export const claimDispatchableOpmlItems = Effect.fn("opml.store.claim_dispatchable")(function* (
  now: Date,
  options: ClaimDispatchableOpmlItemsOptions,
) {
  const db = yield* Db;
  const leaseExpiresAt = new Date(now.getTime() + options.leaseMs);
  const result = yield* db.use("opml.item.claim_dispatchable", (client) =>
    client.execute(sql<ClaimedOpmlItem>`
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
    `),
  );

  return rowsFromExecute<ClaimedOpmlItem>(result);
});

/**
 * Conditionally returns a leased item to pending only if it is still leased under the given
 * token, so a stale/duplicate release can never clobber a newer claim. Returns whether a row
 * was updated.
 */
export const releaseOpmlItemLease = Effect.fn("opml.store.release_lease")(function* (
  itemId: string,
  leaseToken: string,
  availableAt: Date,
) {
  const db = yield* Db;
  const now = yield* DateTime.nowAsDate;
  const updated = yield* db.use("opml.item.release_lease", (client) =>
    client
      .update(opmlImportItems)
      .set({
        status: "pending",
        leaseToken: null,
        leaseExpiresAt: null,
        availableAt,
        updatedAt: now,
      })
      .where(
        and(
          eq(opmlImportItems.id, itemId),
          eq(opmlImportItems.status, "leased"),
          eq(opmlImportItems.leaseToken, leaseToken),
        ),
      )
      .returning({ id: opmlImportItems.id }),
  );
  return updated.length > 0;
});

/** Transitions the parent import from dispatching to running on the first leased item. */
export const markOpmlImportRunning = Effect.fn("opml.store.mark_running")(function* (
  importId: string,
) {
  const db = yield* Db;
  const now = yield* DateTime.nowAsDate;
  yield* db.use("opml.import.mark_running", (client) =>
    client
      .update(opmlImports)
      .set({ status: "running", updatedAt: now })
      .where(and(eq(opmlImports.id, importId), eq(opmlImports.status, "dispatching"))),
  );
});

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
export const claimLeasedOpmlItem = Effect.fn("opml.store.claim_leased_item")(function* (
  importId: string,
  itemId: string,
  leaseToken: string,
) {
  const db = yield* Db;
  const now = yield* DateTime.nowAsDate;
  const [claimed] = yield* db.use("opml.item.claim_leased", (client) =>
    client
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
      .returning(),
  );

  if (!claimed) {
    return null;
  }
  const [parent] = yield* db.use("opml.import.get_owner", (client) =>
    client
      .select({ userId: opmlImports.userId })
      .from(opmlImports)
      .where(eq(opmlImports.id, importId))
      .limit(1),
  );
  if (!parent) {
    return yield* Effect.die(
      new Error(`OPML import ${importId} not found after claiming one of its items`),
    );
  }
  const item: ClaimedLeasedOpmlItem = {
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
  return item;
});

/** The worker no longer owns the item: its lease expired and the reconciler gave the item away. */
export class OpmlLeaseLost extends Data.TaggedError("OpmlLeaseLost")<{ readonly itemId: string }> {}

/**
 * Renews the item's lease every OPML_ITEM_HEARTBEAT_MS, only while status/id/token still match.
 * A database failure is logged and the next beat tries again; a beat that matches no row means
 * the lease is gone, which fails with `OpmlLeaseLost`. Never succeeds, so it only ends when it
 * fails or is interrupted.
 */
const leaseHeartbeat = (claim: ClaimedLeasedOpmlItem) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const log = yield* AppLogger;
    const beat = Effect.gen(function* () {
      const now = yield* DateTime.nowAsDate;
      const renewed = yield* db.use("opml.item.heartbeat", (client) =>
        client
          .update(opmlImportItems)
          .set({ leaseExpiresAt: new Date(now.getTime() + OPML_ITEM_LEASE_MS), updatedAt: now })
          .where(
            and(
              eq(opmlImportItems.id, claim.id),
              eq(opmlImportItems.status, "processing"),
              eq(opmlImportItems.leaseToken, claim.leaseToken),
            ),
          )
          .returning({ id: opmlImportItems.id }),
      );
      if (renewed.length === 0) {
        return yield* new OpmlLeaseLost({ itemId: claim.id });
      }
    }).pipe(
      Effect.catchTag("DatabaseError", (error) =>
        log.warn("opml.import.item.heartbeat_failed", {
          importId: claim.importId,
          itemId: claim.id,
          error: serializeError(error.cause),
        }),
      ),
    );
    return yield* Effect.forever(Effect.andThen(Effect.sleep(OPML_ITEM_HEARTBEAT_MS), beat));
  });

/**
 * Runs `task` while its lease is kept alive. The heartbeat stops with the task, whether it
 * succeeds, fails or is interrupted; losing the lease interrupts the task and fails with
 * `OpmlLeaseLost` so a worker never keeps processing an item another worker now owns.
 */
export const withOpmlItemLeaseHeartbeat = <A, E, R>(
  claim: ClaimedLeasedOpmlItem,
  task: Effect.Effect<A, E, R>,
) => Effect.raceFirst(task, leaseHeartbeat(claim));
