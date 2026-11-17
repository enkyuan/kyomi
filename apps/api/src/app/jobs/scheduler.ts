import { Clock, Duration, Effect, Schedule } from "effect";
import { and, eq, sql } from "drizzle-orm";
import { feeds } from "@kyomi/db";
import { Db } from "@adapters/db/service";
import { AppLogger } from "@adapters/logger/service";
import { JobQueue } from "@adapters/queue/service";
import { AppConfig } from "@config/env/service";
import { serializeError } from "@shared/errors/serialize";
import { logTickFailure } from "./tick";

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

export const countActiveQueuedFeedRefreshes = Effect.fn("feed.scheduler.countQueued")(function* (
  staleQueuedBefore: Date,
) {
  const db = yield* Db;
  const result = yield* db.use("feed.scheduler.count_queued", (client) =>
    client.execute(sql<{ count: number }>`
      SELECT count(*)::int AS count
      FROM feeds
      WHERE refresh_status = 'queued'
        AND updated_at > ${staleQueuedBefore}
    `),
  );
  return rowsFromExecute<{ count: number }>(result)[0]?.count ?? 0;
});

export const claimDueFeedRefreshes = Effect.fn("feed.scheduler.claim")(function* (
  options: SchedulerOptions,
  now: Date,
) {
  const db = yield* Db;
  const normalized = normalizeSchedulerOptions(options);
  const result = yield* db.use("feed.scheduler.claim", (client) =>
    client.execute(
      buildFeedRefreshClaimSql({
        now,
        staleQueuedBefore: new Date(now.getTime() - normalized.queuedLeaseMs),
        staleRunningBefore: new Date(now.getTime() - normalized.runningLeaseMs),
        subscribedLimit: normalized.subscribedLimit,
        globalLimit: normalized.globalLimit,
      }),
    ),
  );
  return rowsFromExecute<ClaimedFeedRefresh>(result);
});

/**
 * Hand a claim back when its job could not be published: the row returns to `idle` (still due, so
 * the next tick claims it again) instead of waiting out the queued lease. Guarded by generation and
 * `queued` status so a claim that was since superseded or started is left alone. Resolves to
 * whether a row was released.
 */
export const releaseFeedRefreshClaim = Effect.fn("feed.scheduler.release")(function* (
  feed: ClaimedFeedRefresh,
  now: Date,
) {
  const db = yield* Db;
  const released = yield* db.use("feed.scheduler.release", (client) =>
    client
      .update(feeds)
      .set({ refreshStatus: "idle", updatedAt: now })
      .where(
        and(
          eq(feeds.id, feed.feedId),
          eq(feeds.refreshGeneration, feed.generation),
          eq(feeds.refreshStatus, "queued"),
        ),
      )
      .returning({ id: feeds.id }),
  );
  return released.length > 0;
});

/**
 * Publish one job per claim. A claim whose job cannot be published is released straight away, so a
 * Redis outage delays those feeds by one tick rather than a full queued lease. Resolves to the
 * number of jobs published.
 */
export const publishClaimedFeedRefreshes = Effect.fn("feed.scheduler.publish")(function* (
  claimed: ReadonlyArray<ClaimedFeedRefresh>,
) {
  const queue = yield* JobQueue;
  const log = yield* AppLogger;
  let published = 0;

  for (const feed of claimed) {
    yield* queue
      .publish({
        type: "feed.refresh",
        payload: {
          feedId: feed.feedId,
          userId: "system",
          reason: feed.reason,
          generation: feed.generation,
        },
      })
      .pipe(
        Effect.map(() => {
          published += 1;
        }),
        Effect.catch((error) =>
          Effect.gen(function* () {
            yield* log.error("feed.scheduler.publish_failed", {
              feedId: feed.feedId,
              error: serializeError(error),
            });
            const now = new Date(yield* Clock.currentTimeMillis);
            yield* releaseFeedRefreshClaim(feed, now).pipe(
              Effect.catch((releaseError) =>
                log.error("feed.scheduler.release_failed", {
                  feedId: feed.feedId,
                  error: serializeError(releaseError),
                }),
              ),
            );
          }),
        ),
      );
  }
  return published;
});

export const runFeedRefreshSchedulerTick = Effect.gen(function* () {
  const config = yield* AppConfig;
  const log = yield* AppLogger;
  const now = new Date(yield* Clock.currentTimeMillis);
  const options = normalizeSchedulerOptions({
    subscribedLimit: config.SUBSCRIBED_FEED_REFRESH_BATCH_SIZE,
    globalLimit: config.GLOBAL_FEED_REFRESH_ENABLED ? config.GLOBAL_FEED_REFRESH_BATCH_SIZE : 0,
    maxQueuedRefreshJobs: config.GLOBAL_FEED_REFRESH_MAX_QUEUED,
    queuedLeaseMs: config.FEED_REFRESH_QUEUED_LEASE_MS,
    runningLeaseMs: config.FEED_REFRESH_RUNNING_LEASE_MS,
  });
  const staleQueuedBefore = new Date(now.getTime() - options.queuedLeaseMs);
  const queuedCount = yield* countActiveQueuedFeedRefreshes(staleQueuedBefore);

  if (queuedCount >= options.maxQueuedRefreshJobs) {
    yield* log.info("feed.scheduler.skipped_backpressure", {
      queuedCount,
      maxQueued: options.maxQueuedRefreshJobs,
    });
    return;
  }

  const remainingCapacity = options.maxQueuedRefreshJobs - queuedCount;
  const claimed = yield* claimDueFeedRefreshes(
    {
      ...options,
      subscribedLimit: Math.min(options.subscribedLimit, remainingCapacity),
      globalLimit: Math.min(options.globalLimit, remainingCapacity),
    },
    now,
  );
  const published = yield* publishClaimedFeedRefreshes(claimed);

  yield* log.info("feed.scheduler.claimed", {
    claimed: claimed.length,
    published,
    queuedCount,
    remainingCapacity,
  });
});

/**
 * Claim due feeds and publish their refresh jobs every `tickMs`, until the scope closes. A tick
 * runs to completion once started (so a claim is never left unpublished by a shutdown); the wait
 * between ticks is what an interruption ends. A failing tick is logged and the next one runs.
 */
export const feedRefreshSchedulerLoop = Effect.gen(function* () {
  const log = yield* AppLogger;
  const { tickMs } = normalizeSchedulerOptions({ tickMs: 60_000 });
  yield* log.info("feed.scheduler.started", { tickMs });

  yield* runFeedRefreshSchedulerTick.pipe(
    Effect.catchCause(logTickFailure("feed.scheduler.failed")),
    Effect.uninterruptible,
    Effect.repeat(Schedule.spaced(Duration.millis(tickMs))),
  );
});
