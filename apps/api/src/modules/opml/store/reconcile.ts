import { Effect } from "effect";
import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { opmlImports } from "@kyomi/db";
import { Db } from "@adapters/db/service";

const RECONCILE_PREPARE_BATCH = 20;
const RECONCILE_RETENTION_BATCH = 100;

/**
 * Finds up to RECONCILE_PREPARE_BATCH imports needing a fresh prepare wakeup: an accepted import
 * with no wakeup yet or one older than `staleWakeupBefore`, or a parsing import whose heartbeat
 * is older than `staleHeartbeatBefore` (returned to accepted first so it can be reclaimed).
 * The reclaim is a guarded update, so multiple scheduler replicas never republish the same
 * stale-parsing import twice in one pass.
 */
export const reclaimStalePrepareImports = Effect.fn("opml.store.reclaim_stale_prepare")(function* (
  now: Date,
  staleWakeupBefore: Date,
  staleHeartbeatBefore: Date,
) {
  const db = yield* Db;
  const due = yield* db.use("opml.import.reclaim_stale_prepare", async (client) => {
    await client
      .update(opmlImports)
      .set({ status: "accepted", updatedAt: now })
      .where(
        and(
          eq(opmlImports.status, "parsing"),
          or(
            sql`${opmlImports.lastHeartbeatAt} IS NULL`,
            lt(opmlImports.lastHeartbeatAt, staleHeartbeatBefore),
          ),
        ),
      );

    return client
      .select({ id: opmlImports.id })
      .from(opmlImports)
      .where(
        and(
          eq(opmlImports.status, "accepted"),
          or(
            sql`${opmlImports.prepareWakeupAt} IS NULL`,
            lt(opmlImports.prepareWakeupAt, staleWakeupBefore),
          ),
        ),
      )
      .limit(RECONCILE_PREPARE_BATCH);
  });
  return due.map((row) => row.id);
});

/** Deletes at most RECONCILE_RETENTION_BATCH terminal imports whose completedAt predates the cutoff. */
export const deleteOldTerminalOpmlImports = Effect.fn("opml.store.delete_old_terminal")(function* (
  olderThan: Date,
) {
  const db = yield* Db;
  return yield* db.use("opml.import.delete_old_terminal", async (client) => {
    const candidates = await client
      .select({ id: opmlImports.id })
      .from(opmlImports)
      .where(
        and(
          inArray(opmlImports.status, ["completed", "failed", "cancelled"]),
          lt(opmlImports.completedAt, olderThan),
        ),
      )
      .limit(RECONCILE_RETENTION_BATCH);
    if (candidates.length === 0) {
      return 0;
    }

    const deleted = await client
      .delete(opmlImports)
      .where(
        inArray(
          opmlImports.id,
          candidates.map((row) => row.id),
        ),
      )
      .returning({ id: opmlImports.id });
    return deleted.length;
  });
});

/** Lists imports currently cancelling, for the reconciler to drain via cancelPendingOpmlItems. */
export const listCancellingOpmlImportIds = Effect.fn("opml.store.list_cancelling")(function* (
  limit: number,
) {
  const db = yield* Db;
  const rows = yield* db.use("opml.import.list_cancelling", (client) =>
    client
      .select({ id: opmlImports.id })
      .from(opmlImports)
      .where(eq(opmlImports.status, "cancelling"))
      .limit(limit),
  );
  return rows.map((row) => row.id);
});
