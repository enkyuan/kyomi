import { env } from "@config/env";
import { logger } from "@adapters/logger";
import { closeRedis, getRedis } from "@adapters/redis";
import { runFeedRefresh } from "@cronos/feed-ingest";
import { consumeJobs } from "@cronos/job-queue";

const controller = new AbortController();

for (const signalName of ["SIGINT", "SIGTERM"] as const) {
  process.on(signalName, () => {
    logger.info("worker.shutdown.requested", { signal: signalName });
    controller.abort();
  });
}

const redis = getRedis();
const consumer = `api-worker-${process.pid}`;

logger.info("worker.started", { consumer });

try {
  await consumeJobs(redis, {
    consumer,
    signal: controller.signal,
    onJob: async ({ id, job }) => {
      if (job.type === "feed.refresh") {
        const result = await runFeedRefresh(env.DATABASE_URL, job.payload.feedId);
        logger.info("worker.job.feed_refresh.completed", {
          streamId: id,
          feedId: job.payload.feedId,
          userId: job.payload.userId,
          ok: result.ok,
          itemCount: result.itemCount,
        });
      }
    },
    onError: async (error, message) => {
      logger.error("worker.job.failed", {
        streamId: message?.id ?? null,
        jobType: message?.job.type ?? null,
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });
} finally {
  await closeRedis();
  logger.info("worker.stopped", { consumer });
}
