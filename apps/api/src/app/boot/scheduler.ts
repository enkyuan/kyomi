import { logger } from "@adapters/logger";
import { closeRedis, getRedis } from "@adapters/redis";
import { runFeedRefreshSchedulerLoop } from "../jobs/refresh-scheduler";

const controller = new AbortController();

for (const signalName of ["SIGINT", "SIGTERM"] as const) {
  process.on(signalName, () => {
    logger.info("scheduler.shutdown.requested", { signal: signalName });
    controller.abort();
  });
}

try {
  await runFeedRefreshSchedulerLoop(getRedis(), controller.signal);
} catch (error) {
  logger.error("scheduler.crashed", {
    error: error instanceof Error ? error.message : String(error),
  });
  throw error;
} finally {
  await closeRedis();
}
