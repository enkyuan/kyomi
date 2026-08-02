import type Redis from "ioredis";
import type { db } from "@adapters/db/client";
import { publishJob } from "@adapters/queue/publish-job";
import {
  claimDispatchableOpmlItems,
  markOpmlImportRunning,
  releaseOpmlItemLease,
} from "@modules/opml/store";

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
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return stats;
}
