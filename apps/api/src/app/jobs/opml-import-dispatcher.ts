import type Redis from "ioredis";
import type { db } from "@adapters/db/client";
import { publishJob } from "@adapters/queue/publish-job";
import { serializeError } from "@shared/utils/serialize-error";
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

type DB = typeof db;
type Logger = {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
};

export const OPML_DISPATCH_MAX_IMPORTS = 10;
export const OPML_DISPATCH_PER_IMPORT = 5;
export const OPML_DISPATCH_TOTAL = 50;
export const OPML_DISPATCH_LEASE_MS = 120_000;
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

export async function runOpmlImportDispatcherTick(
  database: DB,
  redis: Redis,
  logger: Logger,
  now: Date = new Date(),
): Promise<DispatchStats> {
  const claimed = await claimDispatchableOpmlItems(database, now, {
    maxImports: OPML_DISPATCH_MAX_IMPORTS,
    perImport: OPML_DISPATCH_PER_IMPORT,
    total: OPML_DISPATCH_TOTAL,
    leaseMs: OPML_DISPATCH_LEASE_MS,
  });

  const stats: DispatchStats = {
    claimed: claimed.length,
    published: 0,
    releasedAfterPublishFailure: 0,
    importsStarted: 0,
  };
  const startedImports = new Set<string>();

  for (const item of claimed) {
    try {
      await publishJob(redis, {
        type: "opml.import.item",
        payload: { importId: item.importId, itemId: item.id, leaseToken: item.leaseToken },
      });
      stats.published += 1;

      if (!startedImports.has(item.importId)) {
        startedImports.add(item.importId);
        await markOpmlImportRunning(database, item.importId);
        stats.importsStarted += 1;
      }
    } catch (error) {
      const released = await releaseOpmlItemLease(
        database,
        item.id,
        item.leaseToken,
        new Date(now.getTime() + PUBLISH_FAILURE_RETRY_DELAY_MS),
      );
      if (released) {
        stats.releasedAfterPublishFailure += 1;
      }
      logger.error("opml.import.dispatch.publish_failed", {
        importId: item.importId,
        itemId: item.id,
        error: serializeError(error),
      });
    }
  }

  return stats;
}

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
export async function reconcileOpmlImports(
  database: DB,
  redis: Redis,
  logger: Logger,
  now: Date = new Date(),
  options: { includeRetention?: boolean } = {},
): Promise<ReconcileStats> {
  const stats: ReconcileStats = {
    prepareRepublished: 0,
    leasesReclaimed: 0,
    cancellingProcessed: 0,
    retentionDeleted: 0,
  };

  const dueForPrepare = await reclaimStalePrepareImports(
    database,
    now,
    new Date(now.getTime() - RECONCILE_PREPARE_WAKEUP_STALE_MS),
    new Date(now.getTime() - RECONCILE_PARSING_HEARTBEAT_STALE_MS),
  );
  for (const importId of dueForPrepare) {
    try {
      await publishJob(redis, { type: "opml.import.prepare", payload: { importId } });
      await recordOpmlImportPrepareWakeup(database, importId);
      stats.prepareRepublished += 1;
    } catch (error) {
      logger.error("opml.import.reconcile.prepare_republish_failed", {
        importId,
        error: serializeError(error),
      });
    }
  }

  const expiredLeases = await findExpiredOpmlLeases(database, now);
  for (const item of expiredLeases) {
    const decision = classifyOpmlItemError(new Error("lease expired"));
    const delayMs = computeOpmlRetryDelayMs(item.attempts, randomOpmlRetryJitter());
    await retryOrFailOpmlItem(
      database,
      item,
      { retryable: decision.retryable, code: "OPML_ITEM_LEASE_EXPIRED", message: "Lease expired" },
      new Date(now.getTime() + delayMs),
    );
    stats.leasesReclaimed += 1;
  }

  const cancellingImportIds = await listCancellingOpmlImportIds(
    database,
    RECONCILE_CANCEL_BATCH_SIZE,
  );
  for (const importId of cancellingImportIds) {
    let cancelledInBatch = await cancelPendingOpmlItems(
      database,
      importId,
      RECONCILE_CANCEL_BATCH_SIZE,
    );
    while (cancelledInBatch > 0) {
      stats.cancellingProcessed += cancelledInBatch;
      cancelledInBatch = await cancelPendingOpmlItems(
        database,
        importId,
        RECONCILE_CANCEL_BATCH_SIZE,
      );
    }
  }

  if (options.includeRetention) {
    stats.retentionDeleted = await deleteOldTerminalOpmlImports(
      database,
      new Date(now.getTime() - RECONCILE_RETENTION_DAYS * 24 * 60 * 60_000),
    );
  }

  return stats;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Runs the dispatch tick every DISPATCH_TICK_MS and reconciliation every RECONCILE_TICK_MS on
 * one non-blocking loop, so a single scheduler process drives both without a second connection.
 * Retention only needs to run roughly once a day; it piggybacks on whichever reconciliation
 * tick crosses the RETENTION_TICK_MS boundary rather than needing its own timer.
 */
export async function runOpmlImportDispatcherLoop(
  database: DB,
  redis: Redis,
  logger: Logger,
  signal?: AbortSignal,
): Promise<void> {
  logger.info("opml.import.dispatcher.started", {
    dispatchTickMs: DISPATCH_TICK_MS,
    reconcileTickMs: RECONCILE_TICK_MS,
  });

  let lastReconcileAt = 0;
  let lastRetentionAt = 0;

  const maybeReconcile = async (now: number) => {
    if (now - lastReconcileAt < RECONCILE_TICK_MS) {
      return;
    }
    lastReconcileAt = now;
    const includeRetention = now - lastRetentionAt >= RETENTION_TICK_MS;
    lastRetentionAt = includeRetention ? now : lastRetentionAt;
    await reconcileOpmlImports(database, redis, logger, new Date(now), { includeRetention });
  };

  while (!signal?.aborted) {
    try {
      await runOpmlImportDispatcherTick(database, redis, logger);
      await maybeReconcile(Date.now());
    } catch (error) {
      logger.error("opml.import.dispatcher.tick_failed", {
        error: serializeError(error),
      });
    }

    await sleep(DISPATCH_TICK_MS, signal);
  }
}
