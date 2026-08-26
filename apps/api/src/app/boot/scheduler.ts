import { db } from "@adapters/db/client";
import { logger } from "@adapters/logger";
import { closeRedis, getRedis } from "@adapters/redis";
import { runImportDispatcherLoop } from "../jobs/import-dispatcher";
import { runFeedRefreshSchedulerLoop } from "../jobs/refresh-scheduler";

const controller = new AbortController();

for (const signalName of ["SIGINT", "SIGTERM"] as const) {
  process.on(signalName, () => {
    logger.info("scheduler.shutdown.requested", { signal: signalName });
    controller.abort();
  });
}

try {
  const redis = getRedis();
  await Promise.all([
    runFeedRefreshSchedulerLoop(redis, controller.signal),
    runImportDispatcherLoop(db, redis, logger, controller.signal),
  ]);
} catch (error) {
  logger.error("scheduler.crashed", {
    error: error instanceof Error ? error.message : String(error),
  });
  throw error;
} finally {
  await closeRedis();
}
