import { Effect } from "effect";
import { feeds } from "@kyomi/db";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { Db } from "@adapters/db/service";
import { AppLogger } from "@adapters/logger/service";
import { JobQueue } from "@adapters/queue/service";
import { currentDate } from "@shared/effect/clock";
import { serializeError } from "@shared/errors/serialize";

type RefreshReason = "manual" | "subscription_created";

/**
 * How many claim UPDATEs and publishes a batch refresh keeps in flight. The default pool holds 10
 * connections, so one refresh-all leaves the other half for everyone else's requests.
 */
const REFRESH_BATCH_CONCURRENCY = 5;

const claimManualFeedRefresh = Effect.fn("feeds.refresh.claim")(function* (feedId: string) {
  const db = yield* Db;
  const now = yield* currentDate;
  const [claim] = yield* db.use("feeds.refresh.claim", (client) =>
    client
      .update(feeds)
      .set({
        refreshStatus: "queued",
        refreshGeneration: sql`${feeds.refreshGeneration} + 1`,
        lastRefreshError: null,
        updatedAt: now,
      })
      .where(and(eq(feeds.id, feedId), notInArray(feeds.refreshStatus, ["queued", "running"])))
      .returning({ generation: feeds.refreshGeneration }),
  );

  return claim ?? null;
});

/**
 * Publish the refresh job for a claimed feed. A publish failure is not an error for the caller:
 * the claim already moved the feed to `queued`, so the scheduler's stale-queued lease re-delivers
 * it. The failure is logged with its cause and reported as `deliveryPending`.
 */
const deliverClaimedRefresh = Effect.fn("feeds.refresh.deliver")(function* (
  feedId: string,
  userId: string,
  reason: RefreshReason,
  generation: number,
) {
  const queue = yield* JobQueue;
  const log = yield* AppLogger;
  return yield* queue
    .publish({ type: "feed.refresh", payload: { feedId, userId, reason, generation } })
    .pipe(
      Effect.tap((jobId) =>
        log.info("queue.job.enqueued", {
          jobId,
          jobType: "feed.refresh",
          feedId,
          userId,
          reason,
          generation,
        }),
      ),
      Effect.map((jobId) => ({ jobId, deliveryPending: false })),
      Effect.catchTag("RedisError", (error) =>
        log
          .error("queue.job.delivery_pending", {
            feedId,
            userId,
            reason,
            generation,
            error: serializeError(error),
          })
          .pipe(Effect.as({ jobId: "", deliveryPending: true })),
      ),
    );
});

/**
 * Claim the feed and publish its job. Uninterruptible: an interruption between the committed
 * claim and the publish (a lost job lease, a worker shutdown) would leave the feed `queued`
 * with no job until the stale-queued lease expires.
 */
export const enqueueFeedRefresh = Effect.fn("feeds.refresh.enqueue")(function* (
  feedId: string,
  userId: string,
  reason: RefreshReason,
) {
  const claim = yield* claimManualFeedRefresh(feedId);

  if (!claim) {
    return { jobId: "", coalesced: true, deliveryPending: false };
  }

  const { jobId, deliveryPending } = yield* deliverClaimedRefresh(
    feedId,
    userId,
    reason,
    claim.generation,
  );
  return { jobId, generation: claim.generation, coalesced: false, deliveryPending };
}, Effect.uninterruptible);

/** The batch form of `enqueueFeedRefresh`; uninterruptible for the same reason. */
export const enqueueBatchFeedRefresh = Effect.fn("feeds.refresh.enqueue_batch")(function* (
  feedIds: readonly string[],
  userId: string,
  reason: "manual",
) {
  const log = yield* AppLogger;
  if (feedIds.length === 0) {
    return { accepted: true as const, count: 0, coalescedCount: 0, deliveryPendingCount: 0 };
  }

  const claimed = yield* Effect.forEach(
    feedIds,
    (feedId) => Effect.map(claimManualFeedRefresh(feedId), (claim) => ({ feedId, claim })),
    { concurrency: REFRESH_BATCH_CONCURRENCY },
  );
  const claimedFeeds = claimed.flatMap(({ feedId, claim }) => (claim ? [{ feedId, claim }] : []));

  const deliveries = yield* Effect.forEach(
    claimedFeeds,
    ({ feedId, claim }) => deliverClaimedRefresh(feedId, userId, reason, claim.generation),
    { concurrency: REFRESH_BATCH_CONCURRENCY },
  );

  const deliveryPendingCount = deliveries.filter((delivery) => delivery.deliveryPending).length;
  const coalescedCount = feedIds.length - claimedFeeds.length;

  yield* log.info("queue.job.enqueued.batch", {
    count: claimedFeeds.length,
    coalescedCount,
    deliveryPendingCount,
    userId,
  });

  return {
    accepted: true as const,
    count: claimedFeeds.length,
    coalescedCount,
    deliveryPendingCount,
  };
}, Effect.uninterruptible);
