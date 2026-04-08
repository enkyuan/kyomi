import { env } from "@config/env";
import { logger } from "@adapters/logger";
import { closeRedis, getRedis } from "@adapters/redis";
import { runFeedRefresh } from "@cronos/feed-ingest";
import { consumeJobs } from "@cronos/job-queue";

export async function runWorkerLoop(signal?: AbortSignal): Promise<void> {
  const redis = getRedis();
  const consumer = `api-worker-${process.pid}`;

  logger.info("worker.started", { consumer });

  try {
    await consumeJobs(redis, {
      consumer,
      signal,
      onJob: async ({ id, job, attempts }) => {
        if (job.type === "feed.refresh") {
          const result = await runFeedRefresh(env.DATABASE_URL, job.payload.feedId, {
            url: env.MEILI_URL ?? "",
            masterKey: env.MEILI_MASTER_KEY,
            indexUid: env.MEILI_INDEX_FEEDS,
          });
          if (!result.ok) {
            throw new Error("Feed refresh failed");
          }
          logger.info("worker.job.feed_refresh.completed", {
            streamId: id,
            feedId: job.payload.feedId,
            userId: job.payload.userId,
            ok: result.ok,
            itemCount: result.itemCount,
            attempts,
          });
        }
      },
      onError: async (error, message) => {
        logger.error("worker.job.failed", {
          streamId: message?.id ?? null,
          jobType: message?.job.type ?? null,
          attempts: message?.attempts ?? null,
          error: error instanceof Error ? error.message : String(error),
        });
      },
    });
  } finally {
    await closeRedis();
    logger.info("worker.stopped", { consumer });
  }
}
