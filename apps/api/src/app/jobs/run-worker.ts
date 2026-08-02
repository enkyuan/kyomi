import { env } from "@config/env";
import { db } from "@adapters/db/client";
import { assertDevelopmentDatabaseSchemaReady } from "@adapters/db/schema-guard";
import { logger } from "@adapters/logger";
import { closeRedis, getRedis } from "@adapters/redis";
import {
  consumeJobs,
  createHostRateLimiter,
  createRedisHostRateLimitStore,
  FEED_REFRESH_JOBS_STREAM_KEY,
  runFeedRefresh,
  type ArticleExtractionJob,
  type HostRateLimiter,
  type JobMessage,
} from "@kyomi/worker";
import { runOpmlImportFeedJob, runOpmlImportJob } from "@modules/opml/jobs";
import { runArticleExtractionForUser } from "@modules/articles/reader/extraction/workflow";
import { prefetchArticleExtractionsForFeedItems } from "@modules/articles/reader/extraction/prefetch";
import { classifyFeedRefreshError, isNonRetryableFeedRefreshFailure } from "./refresh-errors";

function extractionReasonForFeedRefresh(
  reason: string | undefined,
): NonNullable<ArticleExtractionJob["payload"]["reason"]> {
  switch (reason) {
    case "manual":
    case "subscription_created":
    case "scheduled":
    case "global_scheduled":
      return reason;
    default:
      return "prefetch";
  }
}

async function handleWorkerJob(
  message: JobMessage,
  hostRateLimiter: HostRateLimiter,
): Promise<void> {
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
          hostRateLimiter,
          refreshGeneration: job.payload.generation,
          // Best-effort embedding classification runs alongside the keyword classifier when
          // a key is configured; absent means refresh proceeds with the keyword classifier
          // only, same fallback shape as MEILI_URL above.
          embeddingClassifier: env.VOYAGE_API_KEY ? { apiKey: env.VOYAGE_API_KEY } : undefined,
        },
      );
      const durationMs = Date.now() - startTime;

      if (!result.ok) {
        if (isNonRetryableFeedRefreshFailure(result)) {
          const classification = classifyFeedRefreshError(result.error);
          logger.warn("worker.job.feed_refresh.failed", {
            streamId: id,
            feedId: job.payload.feedId,
            userId: job.payload.userId,
            reason: job.payload.reason,
            errorClass: classification.code,
            retryable: classification.retryable,
            error: result.error,
            attempts,
            durationMs,
          });
          return;
        }

        throw new Error(result.error ?? "Feed refresh failed");
      }
      let extractionPrefetch: Awaited<
        ReturnType<typeof prefetchArticleExtractionsForFeedItems>
      > | null = null;
      if (result.articleExtractionCandidateIds?.length) {
        try {
          extractionPrefetch = await prefetchArticleExtractionsForFeedItems(
            db,
            {
              articleIds: result.articleExtractionCandidateIds,
              userId: job.payload.userId,
              reason: extractionReasonForFeedRefresh(job.payload.reason),
            },
            { logger },
          );
        } catch (error) {
          logger.warn("worker.job.feed_refresh.extraction_prefetch_failed", {
            streamId: id,
            feedId: job.payload.feedId,
            userId: job.payload.userId,
            reason: job.payload.reason,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      logger.info("worker.job.feed_refresh.completed", {
        streamId: id,
        feedId: job.payload.feedId,
        userId: job.payload.userId,
        ok: result.ok,
        notModified: result.notModified ?? false,
        skipped: result.skipped ?? null,
        itemCount: result.itemCount,
        insertedCount: result.insertedCount,
        updatedCount: result.updatedCount,
        categoryStats: result.categoryStats ?? null,
        contentLimitStats: result.contentLimitStats ?? null,
        extractionPrefetch,
        attempts,
        durationMs,
      });
      if (
        result.contentLimitStats &&
        (result.contentLimitStats.droppedItemCount > 0 ||
          result.contentLimitStats.droppedContentItemCount > 0)
      ) {
        logger.info("worker.job.feed_refresh.content_limited", {
          feedId: job.payload.feedId,
          ...result.contentLimitStats,
        });
      }
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
    case "article.extract": {
      const result = await runArticleExtractionForUser(
        db,
        job.payload.userId,
        job.payload.articleId,
        {
          embeddingClassifier: env.VOYAGE_API_KEY
            ? { apiKey: env.VOYAGE_API_KEY, timeoutMs: 8000 }
            : undefined,
          hostRateLimiter,
          logger,
        },
      );
      const durationMs = Date.now() - startTime;

      if (!result.ok) {
        logger.warn("worker.job.article_extract.failed", {
          streamId: id,
          articleId: job.payload.articleId,
          userId: job.payload.userId,
          reason: job.payload.reason,
          errorCode: result.errorCode,
          attempts,
          durationMs,
        });
        return;
      }

      logger.info("worker.job.article_extract.completed", {
        streamId: id,
        articleId: job.payload.articleId,
        userId: job.payload.userId,
        reason: job.payload.reason,
        status: result.status,
        attempts,
        durationMs,
      });
      return;
    }
  }
}

async function logWorkerJobError(error: unknown, message: JobMessage | null): Promise<void> {
  const classification =
    message?.job.type === "feed.refresh"
      ? classifyFeedRefreshError(error)
      : { severity: "platform" as const, code: "unknown" as const, retryable: true };
  const feedRefreshContext =
    message?.job.type === "feed.refresh"
      ? {
          feedId: message.job.payload.feedId,
          userId: message.job.payload.userId,
          reason: message.job.payload.reason,
        }
      : {};
  const articleExtractContext =
    message?.job.type === "article.extract"
      ? {
          articleId: message.job.payload.articleId,
          userId: message.job.payload.userId,
          reason: message.job.payload.reason,
        }
      : {};

  const payload = {
    streamId: message?.id ?? null,
    jobType: message?.job.type ?? null,
    attempts: message?.attempts ?? null,
    ...feedRefreshContext,
    ...articleExtractContext,
    errorClass: classification.code,
    retryable: classification.retryable,
    error: error instanceof Error ? error.message : String(error),
  };

  if (classification.severity === "platform") {
    logger.error("worker.job.failed", payload);
    return;
  }

  logger.warn("worker.job.failed", payload);
}

export async function runWorkerLoop(signal?: AbortSignal): Promise<void> {
  if (env.NODE_ENV === "development") {
    await assertDevelopmentDatabaseSchemaReady();
  }

  const redis = getRedis();
  const consumer = `api-worker-${process.pid}`;
  const hostRateLimiter = createHostRateLimiter({
    store: createRedisHostRateLimitStore(redis),
    leaseMs: env.FEED_FETCH_HOST_LEASE_MS,
    retryDelayMs: env.FEED_FETCH_HOST_RETRY_DELAY_MS,
  });

  logger.info("worker.started", { consumer, streams: env.JOB_STREAMS });

  try {
    await Promise.all(
      env.JOB_STREAMS.map((streamKey) =>
        consumeJobs(redis, {
          consumer: `${consumer}-${streamKey.replace(/[^a-z0-9-]/gi, "-")}`,
          streamKey,
          pendingMinIdleMs:
            streamKey === FEED_REFRESH_JOBS_STREAM_KEY
              ? env.FEED_REFRESH_RUNNING_LEASE_MS
              : undefined,
          count: env.JOB_READ_COUNT,
          processConcurrency: env.JOB_PROCESS_CONCURRENCY,
          streamMaxLength: env.JOB_STREAM_MAX_LENGTH,
          signal,
          onJob: (message) => handleWorkerJob(message, hostRateLimiter),
          onError: logWorkerJobError,
        }),
      ),
    );
  } finally {
    await closeRedis();
    logger.info("worker.stopped", { consumer });
  }
}
