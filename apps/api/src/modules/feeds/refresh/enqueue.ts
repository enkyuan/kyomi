import { feeds } from "@kyomi/db";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { publishJob } from "@adapters/queue/publish-job";
import { getRedis } from "@adapters/redis";
import type { db } from "@adapters/db/client";

type DB = typeof db;
type Logger = {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
};

async function claimManualFeedRefresh(database: DB, feedId: string) {
  const [claim] = await database
    .update(feeds)
    .set({
      refreshStatus: "queued",
      refreshGeneration: sql`${feeds.refreshGeneration} + 1`,
      lastRefreshError: null,
      updatedAt: new Date(),
    })
    .where(and(eq(feeds.id, feedId), notInArray(feeds.refreshStatus, ["queued", "running"])))
    .returning({ generation: feeds.refreshGeneration });

  return claim ?? null;
}

export async function enqueueFeedRefresh(
  database: DB,
  feedId: string,
  userId: string,
  reason: "manual" | "subscription_created",
  logger: Logger,
): Promise<{
  jobId: string;
  generation?: number;
  coalesced: boolean;
  deliveryPending: boolean;
}> {
  const claim = await claimManualFeedRefresh(database, feedId);

  if (!claim) {
    return { jobId: "", coalesced: true, deliveryPending: false };
  }

  try {
    const redis = getRedis();
    const jobId = await publishJob(redis, {
      type: "feed.refresh",
      payload: { feedId, userId, reason, generation: claim.generation },
    });

    logger.info("queue.job.enqueued", {
      jobId,
      jobType: "feed.refresh",
      feedId,
      userId,
      reason,
      generation: claim.generation,
    });
    return {
      jobId,
      generation: claim.generation,
      coalesced: false,
      deliveryPending: false,
    };
  } catch (error) {
    logger.error("queue.job.delivery_pending", {
      feedId,
      userId,
      reason,
      generation: claim.generation,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      jobId: "",
      generation: claim.generation,
      coalesced: false,
      deliveryPending: true,
    };
  }
}

export async function enqueueBatchFeedRefresh(
  database: DB,
  feedIds: string[],
  userId: string,
  reason: "manual",
  logger: Logger,
): Promise<{
  accepted: true;
  count: number;
  coalescedCount: number;
  deliveryPendingCount: number;
}> {
  if (feedIds.length === 0) {
    return { accepted: true, count: 0, coalescedCount: 0, deliveryPendingCount: 0 };
  }

  const claimed = await Promise.all(
    feedIds.map(async (feedId) => ({
      feedId,
      claim: await claimManualFeedRefresh(database, feedId),
    })),
  );

  const claimedFeeds = claimed.filter(
    (item): item is { feedId: string; claim: { generation: number } } => item.claim !== null,
  );
  const deliveryPending = await Promise.all(
    claimedFeeds.map(async ({ feedId, claim }) => {
      try {
        const jobId = await publishJob(getRedis(), {
          type: "feed.refresh",
          payload: { feedId, userId, reason, generation: claim.generation },
        });
        logger.info("queue.job.enqueued", {
          jobId,
          jobType: "feed.refresh",
          feedId,
          userId,
          reason,
          generation: claim.generation,
        });
        return false;
      } catch (error) {
        logger.error("queue.job.delivery_pending", {
          feedId,
          userId,
          reason,
          generation: claim.generation,
          error: error instanceof Error ? error.message : String(error),
        });
        return true;
      }
    }),
  );

  const deliveryPendingCount = deliveryPending.filter(Boolean).length;
  const coalescedCount = feedIds.length - claimedFeeds.length;

  logger.info("queue.job.enqueued.batch", {
    count: claimedFeeds.length,
    coalescedCount,
    deliveryPendingCount,
    userId,
  });

  return {
    accepted: true,
    count: claimedFeeds.length,
    coalescedCount,
    deliveryPendingCount,
  };
}
