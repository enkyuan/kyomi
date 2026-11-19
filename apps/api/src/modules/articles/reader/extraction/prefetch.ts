import { DateTime, Effect } from "effect";
import { Db } from "@adapters/db/service";
import { AppLogger } from "@adapters/logger/service";
import { JobQueue } from "@adapters/queue/service";
import { feedItems } from "@kyomi/db";
import { serializeError } from "@shared/errors/serialize";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { ArticleExtractionJob } from "@kyomi/ingest";

type ExtractionPrefetchReason = NonNullable<ArticleExtractionJob["payload"]["reason"]>;

/** Jobs published at once; publishing is one XADD, so a few in flight is plenty. */
const ENQUEUE_CONCURRENCY = 8;

export type ArticleExtractionPrefetchResult = {
  candidateCount: number;
  claimedCount: number;
  queuedCount: number;
  failedCount: number;
  skippedCount: number;
};

/**
 * Queue full-text extraction for feed items that have never been requested. Claiming is one
 * conditional UPDATE (pending and never requested), so a concurrent prefetch cannot queue the
 * same item twice. An item whose job cannot be published is marked failed instead of staying
 * claimed forever. The claim and the publishes run uninterruptibly: an interruption between them
 * (worker shutdown, a lost job lease) would leave claimed items that are never prefetched again.
 */
export const prefetchArticleExtractionsForFeedItems = Effect.fn("extraction.prefetch")(
  function* (input: {
    articleIds: readonly string[];
    userId: string;
    reason: ExtractionPrefetchReason;
  }) {
    const db = yield* Db;
    const queue = yield* JobQueue;
    const log = yield* AppLogger;

    const articleIds = Array.from(new Set(input.articleIds.filter(Boolean)));
    if (articleIds.length === 0) {
      return {
        candidateCount: 0,
        claimedCount: 0,
        queuedCount: 0,
        failedCount: 0,
        skippedCount: 0,
      } satisfies ArticleExtractionPrefetchResult;
    }

    const claimedAt = yield* DateTime.nowAsDate;
    const claimed = yield* db.use("claim extraction prefetch", (client) =>
      client
        .update(feedItems)
        .set({
          extractedContentStatus: "pending",
          extractedContentError: null,
          extractedContentUpdatedAt: claimedAt,
          updatedAt: claimedAt,
        })
        .where(
          and(
            inArray(feedItems.id, articleIds),
            eq(feedItems.extractedContentStatus, "pending"),
            isNull(feedItems.extractedContentUpdatedAt),
          ),
        )
        .returning({ id: feedItems.id }),
    );

    /** Publish one job; a publish failure marks the item failed and reports `false`. */
    const enqueue = Effect.fn("extraction.prefetch.enqueue")(function* (row: { id: string }) {
      const requestedAt = yield* DateTime.nowAsDate;
      return yield* queue
        .publish({
          type: "article.extract",
          payload: {
            articleId: row.id,
            userId: input.userId,
            requestedAt: requestedAt.toISOString(),
            reason: input.reason,
          },
        })
        .pipe(
          Effect.as(true),
          Effect.catchTag("RedisError", (error) =>
            Effect.gen(function* () {
              const failedAt = yield* DateTime.nowAsDate;
              yield* db.use("mark extraction prefetch failed", (client) =>
                client
                  .update(feedItems)
                  .set({
                    extractedContentHtml: null,
                    extractedContentText: null,
                    extractedContentStatus: "failed",
                    extractedContentError: "Full text extraction could not be queued.",
                    extractedContentUpdatedAt: failedAt,
                    updatedAt: failedAt,
                  })
                  .where(eq(feedItems.id, row.id)),
              );
              yield* log.warn("articles.extract_full_text.prefetch_enqueue_failed", {
                userId: input.userId,
                articleId: row.id,
                reason: input.reason,
                error: serializeError(error),
              });
              return false;
            }),
          ),
        );
    });

    const outcomes = yield* Effect.forEach(claimed, enqueue, { concurrency: ENQUEUE_CONCURRENCY });
    const queuedCount = outcomes.filter(Boolean).length;
    const result = {
      candidateCount: articleIds.length,
      claimedCount: claimed.length,
      queuedCount,
      failedCount: claimed.length - queuedCount,
      skippedCount: articleIds.length - claimed.length,
    } satisfies ArticleExtractionPrefetchResult;
    yield* log.info("articles.extract_full_text.prefetch_enqueued", {
      userId: input.userId,
      reason: input.reason,
      ...result,
    });
    return result;
  },
  Effect.uninterruptible,
);
