import { Clock, Duration, Effect, Ref, Schedule } from "effect";
import { Db } from "@adapters/db/service";
import { AppLogger } from "@adapters/logger/service";
import { JobQueue } from "@adapters/queue/service";
import { serializeError } from "@shared/errors/serialize";
import {
  cancelPendingOpmlItems,
  claimDispatchableOpmlItems,
  deleteOldTerminalOpmlImports,
  findExpiredOpmlLeases,
  listCancellingOpmlImportIds,
  markOpmlImportRunning,
  reclaimStalePrepareImports,
  recordOpmlImportPrepareWakeup,
  releaseOpmlItemLease,
  retryOrFailOpmlItem,
} from "@modules/opml/store";
import {
  classifyOpmlItemError,
  computeOpmlRetryDelayMs,
  randomOpmlRetryJitter,
} from "@modules/opml/retry";
import { OPML_IMPORT_RETENTION_DAYS } from "@modules/opml/constants";
import { logTickFailure } from "./tick";

export const IMPORT_DISPATCH_MAX_IMPORTS = 10;
export const IMPORT_DISPATCH_PER_IMPORT = 5;
export const IMPORT_DISPATCH_TOTAL = 50;
export const IMPORT_DISPATCH_LEASE_MS = 120_000;
const PUBLISH_FAILURE_RETRY_DELAY_MS = 5_000;

const RECONCILE_PREPARE_WAKEUP_STALE_MS = 30_000;
const RECONCILE_PARSING_HEARTBEAT_STALE_MS = 5 * 60_000;
const RECONCILE_CANCEL_BATCH_SIZE = 500;
const RECONCILE_RETENTION_DAYS = OPML_IMPORT_RETENTION_DAYS;

const DISPATCH_TICK_MS = 1_000;
const RECONCILE_TICK_MS = 30_000;
const RETENTION_TICK_MS = 24 * 60 * 60_000;

export type DispatchStats = {
  claimed: number;
  published: number;
  releasedAfterPublishFailure: number;
  importsStarted: number;
};

export const runImportDispatcherTick = Effect.fn("import.dispatcher.tick")(function* (now: Date) {
  const db = yield* Db;
  const queue = yield* JobQueue;
  const log = yield* AppLogger;

  const claimed = yield* db.use("opml.dispatch.claim", (client) =>
    claimDispatchableOpmlItems(client, now, {
      maxImports: IMPORT_DISPATCH_MAX_IMPORTS,
      perImport: IMPORT_DISPATCH_PER_IMPORT,
      total: IMPORT_DISPATCH_TOTAL,
      leaseMs: IMPORT_DISPATCH_LEASE_MS,
    }),
  );

  const stats: DispatchStats = {
    claimed: claimed.length,
    published: 0,
    releasedAfterPublishFailure: 0,
    importsStarted: 0,
  };
  const startedImports = new Set<string>();

  for (const item of claimed) {
    yield* Effect.gen(function* () {
      yield* queue.publish({
        type: "opml.import.item",
        payload: { importId: item.importId, itemId: item.id, leaseToken: item.leaseToken },
      });
      stats.published += 1;

      if (!startedImports.has(item.importId)) {
        startedImports.add(item.importId);
        yield* db.use("opml.dispatch.mark_running", (client) =>
          markOpmlImportRunning(client, item.importId),
        );
        stats.importsStarted += 1;
      }
    }).pipe(
      Effect.catch((error) =>
        Effect.gen(function* () {
          const released = yield* db.use("opml.dispatch.release", (client) =>
            releaseOpmlItemLease(
              client,
              item.id,
              item.leaseToken,
              new Date(now.getTime() + PUBLISH_FAILURE_RETRY_DELAY_MS),
            ),
          );
          if (released) {
            stats.releasedAfterPublishFailure += 1;
          }
          yield* log.error("opml.import.dispatch.publish_failed", {
            importId: item.importId,
            itemId: item.id,
            error: serializeError(error),
          });
        }),
      ),
    );
  }

  return stats;
});

export type ReconcileStats = {
  prepareRepublished: number;
  leasesReclaimed: number;
  cancellingProcessed: number;
  retentionDeleted: number;
};

/**
 * Republishes prepare wakeups for accepted/stale-parsing imports, reclaims items whose lease
 * expired without a worker completing them, drains cancelling imports in bounded batches, and
 * deletes old terminal imports. Every step is bounded and uses guarded/conditional updates so
 * multiple scheduler replicas running this concurrently never duplicate or lose work.
 */
export const reconcileImports = Effect.fn("import.dispatcher.reconcile")(function* (
  now: Date,
  options: { includeRetention?: boolean } = {},
) {
  const db = yield* Db;
  const queue = yield* JobQueue;
  const log = yield* AppLogger;
  const stats: ReconcileStats = {
    prepareRepublished: 0,
    leasesReclaimed: 0,
    cancellingProcessed: 0,
    retentionDeleted: 0,
  };

  const dueForPrepare = yield* db.use("opml.reconcile.reclaim_prepare", (client) =>
    reclaimStalePrepareImports(
      client,
      now,
      new Date(now.getTime() - RECONCILE_PREPARE_WAKEUP_STALE_MS),
      new Date(now.getTime() - RECONCILE_PARSING_HEARTBEAT_STALE_MS),
    ),
  );
  for (const importId of dueForPrepare) {
    yield* queue.publish({ type: "opml.import.prepare", payload: { importId } }).pipe(
      Effect.andThen(
        db.use("opml.reconcile.record_wakeup", (client) =>
          recordOpmlImportPrepareWakeup(client, importId),
        ),
      ),
      Effect.map(() => {
        stats.prepareRepublished += 1;
      }),
      Effect.catch((error) =>
        log.error("opml.import.reconcile.prepare_republish_failed", {
          importId,
          error: serializeError(error),
        }),
      ),
    );
  }

  const expiredLeases = yield* db.use("opml.reconcile.expired_leases", (client) =>
    findExpiredOpmlLeases(client, now),
  );
  for (const item of expiredLeases) {
    const decision = classifyOpmlItemError(new Error("lease expired"));
    const delayMs = computeOpmlRetryDelayMs(item.attempts, randomOpmlRetryJitter());
    yield* db.use("opml.reconcile.retry_item", (client) =>
      retryOrFailOpmlItem(
        client,
        item,
        {
          retryable: decision.retryable,
          code: "OPML_ITEM_LEASE_EXPIRED",
          message: "Lease expired",
        },
        new Date(now.getTime() + delayMs),
      ),
    );
    stats.leasesReclaimed += 1;
  }

  const cancellingImportIds = yield* db.use("opml.reconcile.list_cancelling", (client) =>
    listCancellingOpmlImportIds(client, RECONCILE_CANCEL_BATCH_SIZE),
  );
  const cancelBatch = (importId: string) =>
    db.use("opml.reconcile.cancel_items", (client) =>
      cancelPendingOpmlItems(client, importId, RECONCILE_CANCEL_BATCH_SIZE),
    );
  for (const importId of cancellingImportIds) {
    let cancelledInBatch = yield* cancelBatch(importId);
    while (cancelledInBatch > 0) {
      stats.cancellingProcessed += cancelledInBatch;
      cancelledInBatch = yield* cancelBatch(importId);
    }
  }

  if (options.includeRetention) {
    stats.retentionDeleted = yield* db.use("opml.reconcile.retention", (client) =>
      deleteOldTerminalOpmlImports(
        client,
        new Date(now.getTime() - RECONCILE_RETENTION_DAYS * 24 * 60 * 60_000),
      ),
    );
  }

  return stats;
});

/**
 * Runs the dispatch tick every DISPATCH_TICK_MS and reconciliation every RECONCILE_TICK_MS on
 * one non-blocking loop, so a single scheduler process drives both without a second connection.
 * Retention only needs to run roughly once a day; it piggybacks on whichever reconciliation
 * tick crosses the RETENTION_TICK_MS boundary rather than needing its own timer.
 * A tick runs to completion once started; the wait between ticks is what shutdown interrupts.
 */
export const importDispatcherLoop = Effect.gen(function* () {
  const log = yield* AppLogger;
  yield* log.info("import.dispatcher.started", {
    dispatchTickMs: DISPATCH_TICK_MS,
    reconcileTickMs: RECONCILE_TICK_MS,
  });

  const lastReconcileAt = yield* Ref.make(0);
  const lastRetentionAt = yield* Ref.make(0);

  const maybeReconcile = (nowMs: number) =>
    Effect.gen(function* () {
      if (nowMs - (yield* Ref.get(lastReconcileAt)) < RECONCILE_TICK_MS) {
        return;
      }
      yield* Ref.set(lastReconcileAt, nowMs);
      const includeRetention = nowMs - (yield* Ref.get(lastRetentionAt)) >= RETENTION_TICK_MS;
      if (includeRetention) {
        yield* Ref.set(lastRetentionAt, nowMs);
      }
      yield* reconcileImports(new Date(nowMs), { includeRetention });
    });

  const tick = Effect.gen(function* () {
    const nowMs = yield* Clock.currentTimeMillis;
    yield* runImportDispatcherTick(new Date(nowMs));
    yield* maybeReconcile(nowMs);
  });

  yield* tick.pipe(
    Effect.catchCause(logTickFailure("import.dispatcher.tick_failed")),
    Effect.uninterruptible,
    Effect.repeat(Schedule.spaced(Duration.millis(DISPATCH_TICK_MS))),
  );
});
