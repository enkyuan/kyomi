import { sql } from "drizzle-orm";
import type Redis from "ioredis";
import { feeds } from "@kyomi/db";
import { db } from "@adapters/db/client";
import { assertDevelopmentDatabaseSchemaReady } from "@adapters/db/schema-guard";
import { logger } from "@adapters/logger";
import { publishJob } from "@adapters/queue/publish-job";
import { env } from "@config/env";

export type FeedRefreshScheduleReason = "scheduled" | "global_scheduled";

export type ClaimedFeedRefresh = {
  feedId: string;
  reason: FeedRefreshScheduleReason;
  generation: number;
};

export type SchedulerOptions = {
  subscribedLimit?: number;
  globalLimit?: number;
  maxQueuedRefreshJobs?: number;
  queuedLeaseMs?: number;
  runningLeaseMs?: number;
  tickMs?: number;
};

export function normalizeSchedulerOptions(options: SchedulerOptions = {}) {
  return {
    subscribedLimit: Math.min(Math.max(options.subscribedLimit ?? 50, 1), 5_000),
    globalLimit: Math.min(Math.max(options.globalLimit ?? 10, 0), 1_000),
    maxQueuedRefreshJobs: Math.min(Math.max(options.maxQueuedRefreshJobs ?? 25, 1), 1_000_000),
    queuedLeaseMs: Math.min(Math.max(options.queuedLeaseMs ?? 15 * 60_000, 60_000), 86_400_000),
    runningLeaseMs: Math.min(Math.max(options.runningLeaseMs ?? 30 * 60_000, 60_000), 86_400_000),
    tickMs: Math.min(Math.max(options.tickMs ?? 60_000, 1_000), 3_600_000),
  };
}

export function buildFeedRefreshClaimSql(input: {
  now: Date;
  staleQueuedBefore: Date;
  staleRunningBefore: Date;
  subscribedLimit: number;
  globalLimit: number;
}) {
  return sql<ClaimedFeedRefresh>`
    WITH subscribed_due AS (
      SELECT f.id, 'scheduled'::text AS reason
      FROM feeds f
      WHERE EXISTS (
        SELECT 1 FROM feed_subscriptions fs WHERE fs.feed_id = f.id
      )
        AND (f.next_refresh_at IS NULL OR f.next_refresh_at <= ${input.now})
        AND (
          f.refresh_status NOT IN ('running', 'queued')
          OR (f.refresh_status = 'queued' AND f.updated_at <= ${input.staleQueuedBefore})
          OR (f.refresh_status = 'running' AND f.updated_at <= ${input.staleRunningBefore})
        )
      ORDER BY f.next_refresh_at NULLS FIRST, f.id
      FOR UPDATE SKIP LOCKED
      LIMIT ${input.subscribedLimit}
    ),
    global_due AS (
      SELECT f.id, 'global_scheduled'::text AS reason
      FROM feeds f
      WHERE ${input.globalLimit} > 0
        AND NOT EXISTS (
          SELECT 1 FROM feed_subscriptions fs WHERE fs.feed_id = f.id
        )
        AND (f.next_refresh_at IS NULL OR f.next_refresh_at <= ${input.now})
        AND (
          f.refresh_status NOT IN ('running', 'queued')
          OR (f.refresh_status = 'queued' AND f.updated_at <= ${input.staleQueuedBefore})
          OR (f.refresh_status = 'running' AND f.updated_at <= ${input.staleRunningBefore})
        )
      ORDER BY
        CASE WHEN EXISTS (
          SELECT 1 FROM feed_items fi WHERE fi.feed_id = f.id
        ) THEN 1 ELSE 0 END,
        f.next_refresh_at NULLS FIRST,
        f.id
      FOR UPDATE SKIP LOCKED
      LIMIT ${input.globalLimit}
    ),
    claimed AS (
      SELECT * FROM subscribed_due
      UNION ALL
      SELECT * FROM global_due
    )
    UPDATE feeds
    SET refresh_status = 'queued',
        refresh_generation = feeds.refresh_generation + 1,
        last_refresh_error = NULL,
        updated_at = ${input.now}
    FROM claimed
    WHERE feeds.id = claimed.id
    RETURNING feeds.id AS "feedId", claimed.reason AS reason,
              feeds.refresh_generation AS "generation"
  `;
}

function rowsFromExecute<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }

  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }

  return [];
}

export async function countActiveQueuedFeedRefreshes(staleQueuedBefore: Date): Promise<number> {
  const result = await db.execute(sql<{ count: number }>`
    SELECT count(*)::int AS count
    FROM feeds
    WHERE refresh_status = 'queued'
      AND updated_at > ${staleQueuedBefore}
  `);

  return rowsFromExecute<{ count: number }>(result)[0]?.count ?? 0;
}

export async function claimDueFeedRefreshes(
  options: SchedulerOptions = {},
  now = new Date(),
): Promise<ClaimedFeedRefresh[]> {
  const normalized = normalizeSchedulerOptions(options);
  const staleQueuedBefore = new Date(now.getTime() - normalized.queuedLeaseMs);
  const staleRunningBefore = new Date(now.getTime() - normalized.runningLeaseMs);

  const result = await db.execute(
    buildFeedRefreshClaimSql({
      now,
      staleQueuedBefore,
      staleRunningBefore,
      subscribedLimit: normalized.subscribedLimit,
      globalLimit: normalized.globalLimit,
    }),
  );

  return rowsFromExecute<ClaimedFeedRefresh>(result);
}

export async function publishClaimedFeedRefreshes(
  redis: Redis,
  claimed: ClaimedFeedRefresh[],
): Promise<void> {
  for (const feed of claimed) {
    try {
      await publishJob(redis, {
        type: "feed.refresh",
        payload: {
          feedId: feed.feedId,
          userId: "system",
          reason: feed.reason,
          generation: feed.generation,
        },
      });
    } catch (error) {
      logger.error("feed.scheduler.publish_failed", {
        feedId: feed.feedId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
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

export async function runFeedRefreshSchedulerTick(redis: Redis): Promise<void> {
  const now = new Date();
  const options = normalizeSchedulerOptions({
    subscribedLimit: env.SUBSCRIBED_FEED_REFRESH_BATCH_SIZE,
    globalLimit: env.GLOBAL_FEED_REFRESH_ENABLED ? env.GLOBAL_FEED_REFRESH_BATCH_SIZE : 0,
    maxQueuedRefreshJobs: env.GLOBAL_FEED_REFRESH_MAX_QUEUED,
    queuedLeaseMs: env.FEED_REFRESH_QUEUED_LEASE_MS,
    runningLeaseMs: env.FEED_REFRESH_RUNNING_LEASE_MS,
  });
  const staleQueuedBefore = new Date(now.getTime() - options.queuedLeaseMs);
  const queuedCount = await countActiveQueuedFeedRefreshes(staleQueuedBefore);

  if (queuedCount >= options.maxQueuedRefreshJobs) {
    logger.info("feed.scheduler.skipped_backpressure", {
      queuedCount,
      maxQueued: options.maxQueuedRefreshJobs,
    });
    return;
  }

  const remainingCapacity = options.maxQueuedRefreshJobs - queuedCount;
  const claimed = await claimDueFeedRefreshes({
    ...options,
    subscribedLimit: Math.min(options.subscribedLimit, remainingCapacity),
    globalLimit: Math.min(options.globalLimit, remainingCapacity),
  });

  await publishClaimedFeedRefreshes(redis, claimed);

  logger.info("feed.scheduler.claimed", {
    claimed: claimed.length,
    queuedCount,
    remainingCapacity,
  });
}

export async function runFeedRefreshSchedulerLoop(
  redis: Redis,
  signal?: AbortSignal,
): Promise<void> {
  if (env.NODE_ENV === "development") {
    await assertDevelopmentDatabaseSchemaReady();
  }

  const options = normalizeSchedulerOptions({
    tickMs: 60_000,
  });

  logger.info("feed.scheduler.started", { tickMs: options.tickMs });

  while (!signal?.aborted) {
    try {
      await runFeedRefreshSchedulerTick(redis);
    } catch (error) {
      logger.error("feed.scheduler.failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await sleep(options.tickMs, signal);
  }
}
