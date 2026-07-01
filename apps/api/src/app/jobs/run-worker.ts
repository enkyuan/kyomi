import { env } from "@config/env";
import { db } from "@adapters/db/client";
import { logger } from "@adapters/logger";
import { closeRedis, getRedis } from "@adapters/redis";
import { consumeJobs, runFeedRefresh, type JobMessage } from "@kyomi/worker";
import { publishJob } from "@adapters/queue/publish-job";
import { runOpmlImportFeedJob, runOpmlImportJob } from "@modules/opml/service";
import { feedItems, feedSubscriptions, feeds } from "@kyomi/db";
import { lte, and, asc, ne, eq, or, isNull, sql } from "drizzle-orm";
import type Redis from "ioredis";

const SUBSCRIBED_FEED_REFRESH_BATCH_SIZE = 50;
const SCHEDULER_TICK_MS = 60_000;
const GLOBAL_FEED_REFRESH_REASON = "global_scheduled";

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

async function handleFeedRefreshJob(message: JobMessage): Promise<void> {
  const { id, job, attempts } = message;
  const startTime = Date.now();

  switch (job.type) {
    case "feed.refresh": {
      // Canonical refresh execution path: queued job -> worker -> ingestion.
      // API/read paths should only enqueue or read status, never run refresh inline.
      const result = await runFeedRefresh(
        db,
        job.payload.feedId,
        {
          url: env.MEILI_URL ?? "",
          masterKey: env.MEILI_MASTER_KEY,
          indexUid: env.MEILI_INDEX_FEEDS,
        },
        {
          // Prioritize quick first-item availability immediately after follow/catalog scheduling.
          enrichArticles:
            job.payload.reason !== "subscription_created" &&
            job.payload.reason !== GLOBAL_FEED_REFRESH_REASON,
        },
      );
      const durationMs = Date.now() - startTime;

      if (!result.ok) {
        throw new Error(result.error ?? "Feed refresh failed");
      }
      logger.info("worker.job.feed_refresh.completed", {
        streamId: id,
        feedId: job.payload.feedId,
        userId: job.payload.userId,
        ok: result.ok,
        notModified: result.notModified ?? false,
        itemCount: result.itemCount,
        insertedCount: result.insertedCount,
        updatedCount: result.updatedCount,
        attempts,
        durationMs,
      });
      return;
    }
    case "opml.import": {
      await runOpmlImportJob(db, job.payload, logger);
      logger.info("worker.job.opml_import.completed", {
        streamId: id,
        taskId: job.payload.taskId,
        userId: job.payload.userId,
        attempts,
        durationMs: Date.now() - startTime,
      });
      return;
    }
    case "opml.import.feed": {
      await runOpmlImportFeedJob(db, job.payload, logger);
      logger.info("worker.job.opml_import_feed.completed", {
        streamId: id,
        taskId: job.payload.taskId,
        userId: job.payload.userId,
        url: job.payload.url,
        attempts,
        durationMs: Date.now() - startTime,
      });
      return;
    }
  }
}

async function logWorkerJobError(error: unknown, message: JobMessage | null): Promise<void> {
  logger.error("worker.job.failed", {
    streamId: message?.id ?? null,
    jobType: message?.job.type ?? null,
    attempts: message?.attempts ?? null,
    error: error instanceof Error ? error.message : String(error),
  });
}

export async function runWorkerLoop(signal?: AbortSignal): Promise<void> {
  const redis = getRedis();
  const consumer = `api-worker-${process.pid}`;

  logger.info("worker.started", { consumer });

  const schedulerPromise = runStaleFeedScheduler(signal);

  try {
    await consumeJobs(redis, {
      consumer,
      signal,
      onJob: handleFeedRefreshJob,
      onError: logWorkerJobError,
    });
  } finally {
    await closeRedis();
    await schedulerPromise.catch(() => {});
    logger.info("worker.stopped", { consumer });
  }
}

async function markStaleFeedPublishFailed(feedId: string, err: unknown): Promise<void> {
  const failedAt = new Date();
  await db
    .update(feeds)
    .set({
      refreshStatus: "failed",
      lastRefreshFailedAt: failedAt,
      lastRefreshCompletedAt: failedAt,
      lastRefreshError: err instanceof Error ? err.message : String(err),
      nextRefreshAt: new Date(failedAt.getTime() + 15 * 60 * 1000),
    })
    .where(eq(feeds.id, feedId))
    .catch(() => {});
  logger.error("scheduler.stale_feeds.publish_error", {
    feedId,
    error: err instanceof Error ? err.message : String(err),
  });
}

async function queueStaleFeed(
  redis: Redis,
  feedId: string,
  reason: "scheduled" | typeof GLOBAL_FEED_REFRESH_REASON,
): Promise<void> {
  await db
    .update(feeds)
    .set({ refreshStatus: "queued", lastRefreshError: null })
    .where(eq(feeds.id, feedId));
  await publishJob(redis, {
    type: "feed.refresh",
    payload: { feedId, userId: "system", reason },
  }).catch((err) => markStaleFeedPublishFailed(feedId, err));
}

async function enqueueStaleFeeds(
  redis: Redis,
  staleFeeds: { id: string }[],
  reason: "scheduled" | typeof GLOBAL_FEED_REFRESH_REASON,
  signal?: AbortSignal,
): Promise<void> {
  if (staleFeeds.length === 0) {
    return;
  }

  logger.info("scheduler.stale_feeds.found", { count: staleFeeds.length, reason });
  for (const feed of staleFeeds) {
    if (signal?.aborted) {
      return;
    }
    await queueStaleFeed(redis, feed.id, reason);
  }
}

async function countQueuedFeeds(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(feeds)
    .where(eq(feeds.refreshStatus, "queued"));
  return row?.count ?? 0;
}

async function runStaleFeedSchedulerTick(redis: Redis, signal?: AbortSignal): Promise<void> {
  const now = new Date();
  const subscribedFeeds = await db
    .select({ id: feeds.id })
    .from(feeds)
    .where(
      and(
        // Only schedule feeds that have at least one active subscriber.
        // This prevents queue flooding from globally imported-but-unfollowed feeds.
        sql`exists (select 1 from ${feedSubscriptions} fs where fs.feed_id = ${feeds.id})`,
        or(isNull(feeds.nextRefreshAt), lte(feeds.nextRefreshAt, now)),
        ne(feeds.refreshStatus, "running"),
        ne(feeds.refreshStatus, "queued"),
      ),
    )
    .limit(SUBSCRIBED_FEED_REFRESH_BATCH_SIZE);

  await enqueueStaleFeeds(redis, subscribedFeeds, "scheduled", signal);

  if (!env.GLOBAL_FEED_REFRESH_ENABLED || env.GLOBAL_FEED_REFRESH_BATCH_SIZE <= 0) {
    return;
  }

  const queuedCount = await countQueuedFeeds();
  const queueBudget = Math.max(0, env.GLOBAL_FEED_REFRESH_MAX_QUEUED - queuedCount);
  const globalLimit = Math.min(env.GLOBAL_FEED_REFRESH_BATCH_SIZE, queueBudget);
  if (globalLimit <= 0) {
    logger.info("scheduler.global_feeds.skipped_backpressure", {
      queuedCount,
      maxQueued: env.GLOBAL_FEED_REFRESH_MAX_QUEUED,
    });
    return;
  }

  const globalFeeds = await db
    .select({ id: feeds.id })
    .from(feeds)
    .where(
      and(
        or(isNull(feeds.nextRefreshAt), lte(feeds.nextRefreshAt, now)),
        ne(feeds.refreshStatus, "running"),
        ne(feeds.refreshStatus, "queued"),
      ),
    )
    .orderBy(
      sql`case when exists (select 1 from ${feedItems} fi where fi.feed_id = ${feeds.id}) then 1 else 0 end`,
      asc(feeds.nextRefreshAt),
      asc(feeds.id),
    )
    .limit(globalLimit);

  await enqueueStaleFeeds(redis, globalFeeds, GLOBAL_FEED_REFRESH_REASON, signal);
}

async function runStaleFeedScheduler(signal?: AbortSignal) {
  const redis = getRedis();
  while (!signal?.aborted) {
    try {
      await runStaleFeedSchedulerTick(redis, signal);
    } catch (err) {
      logger.error("scheduler.stale_feeds.error", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if (signal?.aborted) {
      break;
    }
    await sleep(SCHEDULER_TICK_MS, signal);
  }
}
