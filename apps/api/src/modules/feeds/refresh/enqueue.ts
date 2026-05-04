import { feeds } from "@cronos/db";
import { eq, inArray } from "drizzle-orm";
import { publishJob } from "@adapters/queue/publish-job";
import { getRedis } from "@adapters/redis";
import type { db } from "@adapters/db/client";
import { AppError } from "@shared/errors/app-error";

type DB = typeof db;
type Logger = {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
};

export async function enqueueFeedRefresh(
  database: DB,
  feedId: string,
  userId: string,
  reason: "manual" | "subscription_created",
  logger: Logger,
): Promise<{ jobId: string }> {
  try {
    const redis = getRedis();
    const jobId = await publishJob(redis, {
      type: "feed.refresh",
      payload: { feedId, userId, reason },
    });
    await database
      .update(feeds)
      .set({ refreshStatus: "queued", lastRefreshError: null })
      .where(eq(feeds.id, feedId));

    logger.info("queue.job.enqueued", {
      jobId,
      jobType: "feed.refresh",
      feedId,
      userId,
      reason,
    });
    return { jobId };
  } catch (error) {
    if (reason !== "subscription_created") {
      logger.error("queue.job.enqueue.failed", {
        feedId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new AppError("Failed to enqueue feed refresh", {
        status: 503,
        code: "QUEUE_UNAVAILABLE",
      });
    }

    logger.warn("queue.job.enqueue.skipped", {
      feedId,
      userId,
      reason,
      error: error instanceof Error ? error.message : String(error),
    });
    return { jobId: "" };
  }
}

export async function enqueueBatchFeedRefresh(
  database: DB,
  feedIds: string[],
  userId: string,
  reason: "manual",
  logger: Logger,
): Promise<{ accepted: true; count: number; failedCount: number }> {
  if (feedIds.length === 0) {
    return { accepted: true, count: 0, failedCount: 0 };
  }

  const redis = getRedis();
  const results = await Promise.allSettled(
    feedIds.map((feedId) =>
      publishJob(redis, {
        type: "feed.refresh",
        payload: { feedId, userId, reason },
      }).then((jobId) => ({ feedId, jobId })),
    ),
  );

  const successfulFeedIds: string[] = [];
  const failedFeedIds: string[] = [];

  for (const [index, result] of results.entries()) {
    if (result.status === "fulfilled") {
      successfulFeedIds.push(result.value.feedId);
    } else {
      failedFeedIds.push(feedIds[index]!);
      logger.error("queue.job.enqueue.batch_item.failed", {
        userId,
        feedId: feedIds[index],
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  }

  if (successfulFeedIds.length > 0) {
    await database
      .update(feeds)
      .set({ refreshStatus: "queued", lastRefreshError: null })
      .where(inArray(feeds.id, successfulFeedIds));
  }

  if (successfulFeedIds.length === 0 && feedIds.length > 0) {
    logger.error("queue.job.enqueue.batch.all_failed", {
      userId,
      count: feedIds.length,
    });
    throw new AppError("Failed to enqueue batch feed refresh", {
      status: 503,
      code: "QUEUE_UNAVAILABLE",
    });
  }

  logger.info("queue.job.enqueued.batch", {
    count: successfulFeedIds.length,
    failedCount: failedFeedIds.length,
    userId,
  });

  return { accepted: true, count: successfulFeedIds.length, failedCount: failedFeedIds.length };
}
