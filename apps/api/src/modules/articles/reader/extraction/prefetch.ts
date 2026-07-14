import type { db } from "@adapters/db/client";
import { getRedis } from "@adapters/redis";
import { publishJob } from "@adapters/queue/publish-job";
import { feedItems } from "@kyomi/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { ArticleExtractionJob } from "@kyomi/worker";

type DB = typeof db;
type ExtractionPrefetchLogger = {
  info?: (message: string, data?: Record<string, unknown>) => void;
  warn?: (message: string, data?: Record<string, unknown>) => void;
};

type ExtractionPrefetchReason = NonNullable<ArticleExtractionJob["payload"]["reason"]>;

export type ArticleExtractionPrefetchResult = {
  candidateCount: number;
  claimedCount: number;
  queuedCount: number;
  failedCount: number;
  skippedCount: number;
};

async function defaultEnqueueExtractionJob(job: ArticleExtractionJob): Promise<string> {
  return publishJob(getRedis(), job);
}

export async function prefetchArticleExtractionsForFeedItems(
  database: DB,
  input: {
    articleIds: readonly string[];
    userId: string;
    reason: ExtractionPrefetchReason;
  },
  options: {
    enqueueExtractionJob?: (job: ArticleExtractionJob) => Promise<string>;
    logger?: ExtractionPrefetchLogger;
  } = {},
): Promise<ArticleExtractionPrefetchResult> {
  const articleIds = Array.from(new Set(input.articleIds.filter(Boolean)));
  if (articleIds.length === 0) {
    return { candidateCount: 0, claimedCount: 0, queuedCount: 0, failedCount: 0, skippedCount: 0 };
  }

  const now = new Date();
  const claimed = await database
    .update(feedItems)
    .set({
      extractedContentStatus: "pending",
      extractedContentError: null,
      extractedContentUpdatedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        inArray(feedItems.id, articleIds),
        eq(feedItems.extractedContentStatus, "pending"),
        isNull(feedItems.extractedContentUpdatedAt),
      ),
    )
    .returning({ id: feedItems.id });

  const enqueueExtractionJob = options.enqueueExtractionJob ?? defaultEnqueueExtractionJob;
  let queuedCount = 0;
  let failedCount = 0;

  for (const row of claimed) {
    try {
      await enqueueExtractionJob({
        type: "article.extract",
        payload: {
          articleId: row.id,
          userId: input.userId,
          requestedAt: new Date().toISOString(),
          reason: input.reason,
        },
      });
      queuedCount += 1;
    } catch (error) {
      failedCount += 1;
      const message = "Full text extraction could not be queued.";
      await database
        .update(feedItems)
        .set({
          extractedContentHtml: null,
          extractedContentText: null,
          extractedContentStatus: "failed",
          extractedContentError: message,
          extractedContentUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(feedItems.id, row.id));
      options.logger?.warn?.("articles.extract_full_text.prefetch_enqueue_failed", {
        userId: input.userId,
        articleId: row.id,
        reason: input.reason,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const result = {
    candidateCount: articleIds.length,
    claimedCount: claimed.length,
    queuedCount,
    failedCount,
    skippedCount: articleIds.length - claimed.length,
  };
  options.logger?.info?.("articles.extract_full_text.prefetch_enqueued", {
    userId: input.userId,
    reason: input.reason,
    ...result,
  });
  return result;
}
