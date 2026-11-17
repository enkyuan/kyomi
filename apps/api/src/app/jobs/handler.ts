import { Clock, Effect } from "effect";
import {
  createHostRateLimiter,
  createRedisHostRateLimitStore,
  runFeedRefresh,
  type ArticleExtractionJob,
  type FeedRefreshJob,
  type JobMessage,
} from "@kyomi/ingest";
import { Db } from "@adapters/db/service";
import type { AppLogger as LogSink } from "@adapters/logger/pino";
import { AppLogger, type AppLoggerShape } from "@adapters/logger/service";
import type { FailureDisposition } from "@adapters/queue/consumer";
import { Redis } from "@adapters/redis/service";
import { AppConfig } from "@config/env/service";
import { embeddingClassifierConfig } from "@config/embeddings";
import { enqueueEnrichmentForStoredDocument } from "@modules/articles/document/enrich";
import { createDocumentPatchStore } from "@modules/articles/document/store";
import { handleDocumentEnrichmentJob } from "@modules/articles/document-enrichment/jobs";
import { prefetchArticleExtractionsForFeedItems } from "@modules/articles/reader/extraction/prefetch";
import { runArticleExtractionForUser } from "@modules/articles/reader/extraction/workflow";
import {
  runOpmlImportFeedJob,
  runOpmlImportItemJob,
  runOpmlImportJob,
  runOpmlImportPrepareJob,
} from "@modules/opml/jobs";
import { serializeError } from "@shared/errors/serialize";
import {
  FeedRefreshFailed,
  classifyJobFailure,
  isNonRetryableFeedRefreshFailure,
  toJobFailure,
  type JobFailure,
} from "./classify";

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

/** The synchronous logger legacy Promise operations expect, over the `AppLogger` service. */
function promiseLogger(log: AppLoggerShape): LogSink {
  return {
    info: (event, context) => Effect.runSync(log.info(event, context)),
    warn: (event, context) => Effect.runSync(log.warn(event, context)),
    error: (event, context) => Effect.runSync(log.error(event, context)),
  };
}

/** Run a legacy Promise operation; whatever it throws becomes a typed `JobFailure`. */
const attempt = <A>(run: () => Promise<A>) => Effect.tryPromise({ try: run, catch: toJobFailure });

/**
 * Build the job handler: one Effect per job type that runs the owning module's operation against
 * the services in scope. Failures are typed (`JobFailure`) so the consumer can classify them.
 */
export const makeJobHandler = Effect.gen(function* () {
  const config = yield* AppConfig;
  const { client: database } = yield* Db;
  const redis = yield* Redis;
  const log = yield* AppLogger;
  const logger = promiseLogger(log);
  const hostRateLimiter = createHostRateLimiter({
    store: createRedisHostRateLimitStore(redis.client),
    leaseMs: config.FEED_FETCH_HOST_LEASE_MS,
    retryDelayMs: config.FEED_FETCH_HOST_RETRY_DELAY_MS,
  });

  const elapsedSince = (startedAt: number) =>
    Effect.map(Clock.currentTimeMillis, (now) => now - startedAt);

  const refreshFeed = (
    message: { id: string; attempts: number; job: FeedRefreshJob },
    startedAt: number,
  ) =>
    Effect.gen(function* () {
      const { job, id, attempts } = message;
      // Canonical refresh execution path: queued job -> worker -> ingestion.
      // API/read paths should only enqueue or read status, never run refresh inline.
      const result = yield* attempt(() =>
        runFeedRefresh(
          database,
          job.payload.feedId,
          {
            url: config.MEILI_URL ?? "",
            masterKey: config.MEILI_MASTER_KEY,
            indexUid: config.MEILI_INDEX_FEEDS,
          },
          {
            hostRateLimiter,
            refreshGeneration: job.payload.generation,
            // Best-effort embedding classification runs alongside the keyword classifier when a
            // key is configured; absent means refresh proceeds with the keyword classifier only.
            // The timeout bounds each embeddings request, so a stalled provider can't hold the
            // refresh job indefinitely.
            embeddingClassifier: embeddingClassifierConfig(30_000, config),
          },
        ),
      );
      const durationMs = yield* elapsedSince(startedAt);
      for (const itemId of result.documentItemIds ?? []) {
        yield* attempt(() =>
          enqueueEnrichmentForStoredDocument(database, {
            table: "feed_items",
            id: itemId,
            body: "original",
          }),
        );
      }

      if (!result.ok) {
        if (isNonRetryableFeedRefreshFailure(result)) {
          yield* log.warn("worker.job.feed_refresh.failed", {
            streamId: id,
            feedId: job.payload.feedId,
            userId: job.payload.userId,
            reason: job.payload.reason,
            errorClass: result.failureClass ?? "unknown",
            retryable: false,
            error: result.error,
            attempts,
            durationMs,
          });
          return;
        }
        return yield* new FeedRefreshFailed({
          message: result.error ?? "Feed refresh failed",
          feedId: job.payload.feedId,
          failureClass: result.failureClass,
        });
      }

      const extractionPrefetch = result.articleExtractionCandidateIds?.length
        ? yield* attempt(() =>
            prefetchArticleExtractionsForFeedItems(
              database,
              {
                articleIds: result.articleExtractionCandidateIds ?? [],
                userId: job.payload.userId,
                reason: extractionReasonForFeedRefresh(job.payload.reason),
              },
              { logger },
            ),
          ).pipe(
            Effect.catch((error) =>
              log
                .warn("worker.job.feed_refresh.extraction_prefetch_failed", {
                  streamId: id,
                  feedId: job.payload.feedId,
                  userId: job.payload.userId,
                  reason: job.payload.reason,
                  error: serializeError(error.cause ?? error),
                })
                .pipe(Effect.as(null)),
            ),
          )
        : null;

      yield* log.info("worker.job.feed_refresh.completed", {
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
        yield* log.info("worker.job.feed_refresh.content_limited", {
          feedId: job.payload.feedId,
          ...result.contentLimitStats,
        });
      }
    });

  const extractArticle = (
    message: { id: string; attempts: number; job: ArticleExtractionJob },
    startedAt: number,
  ) =>
    Effect.gen(function* () {
      const { job, id, attempts } = message;
      const result = yield* attempt(() =>
        runArticleExtractionForUser(database, job.payload.userId, job.payload.articleId, {
          embeddingClassifier: embeddingClassifierConfig(8000, config),
          hostRateLimiter,
          logger,
          titleReplacement: {
            replaceClipTitle: job.payload.replaceClipTitle ?? false,
            autogeneratedTitleAtQueue: job.payload.autogeneratedTitleAtQueue,
          },
        }),
      );
      const durationMs = yield* elapsedSince(startedAt);
      const fields = {
        streamId: id,
        articleId: job.payload.articleId,
        userId: job.payload.userId,
        reason: job.payload.reason,
        attempts,
        durationMs,
      };

      if (!result.ok) {
        yield* log.warn("worker.job.article_extract.failed", {
          ...fields,
          errorCode: result.errorCode,
        });
        return;
      }
      yield* log.info("worker.job.article_extract.completed", { ...fields, status: result.status });
    });

  const completed = (
    event: string,
    startedAt: number,
    message: JobMessage,
    fields: Record<string, unknown>,
  ) =>
    Effect.flatMap(elapsedSince(startedAt), (durationMs) =>
      log.info(event, { streamId: message.id, ...fields, attempts: message.attempts, durationMs }),
    );

  return (message: JobMessage): Effect.Effect<void, JobFailure> =>
    Effect.gen(function* () {
      const { job } = message;
      const startedAt = yield* Clock.currentTimeMillis;

      switch (job.type) {
        case "feed.refresh":
          return yield* refreshFeed({ ...message, job }, startedAt);
        case "opml.import":
          yield* attempt(() => runOpmlImportJob(database, job.payload, logger));
          return yield* completed("worker.job.opml_import.completed", startedAt, message, {
            taskId: job.payload.taskId,
            userId: job.payload.userId,
          });
        case "opml.import.feed":
          yield* attempt(() => runOpmlImportFeedJob(database, job.payload, logger));
          return yield* completed("worker.job.opml_import_feed.completed", startedAt, message, {
            taskId: job.payload.taskId,
            userId: job.payload.userId,
            url: job.payload.url,
          });
        case "opml.import.prepare":
          return yield* attempt(() => runOpmlImportPrepareJob(database, job.payload, logger));
        case "opml.import.item":
          return yield* attempt(() => runOpmlImportItemJob(database, job.payload, logger));
        case "article.extract":
          return yield* extractArticle({ ...message, job }, startedAt);
        case "document.image-measure":
        case "document.embed-snapshot":
          return yield* attempt(() =>
            handleDocumentEnrichmentJob(job, createDocumentPatchStore(database)),
          );
      }
    });
});

function failureContext(message: JobMessage | null): Record<string, unknown> {
  const job = message?.job;
  switch (job?.type) {
    case "feed.refresh":
      return { feedId: job.payload.feedId, userId: job.payload.userId, reason: job.payload.reason };
    case "article.extract":
      return {
        articleId: job.payload.articleId,
        userId: job.payload.userId,
        reason: job.payload.reason,
      };
    default:
      return {};
  }
}

/**
 * Build the consumer's failure policy: log the failure (warn for expected ones, error for ours)
 * and retry only what `classifyJobFailure` says can succeed on another attempt.
 */
export const makeFailureReporter = Effect.gen(function* () {
  const log = yield* AppLogger;
  return (error: JobFailure, message: JobMessage | null): Effect.Effect<FailureDisposition> => {
    const classification = classifyJobFailure(error);
    const fields = {
      streamId: message?.id ?? null,
      jobType: message?.job.type ?? null,
      attempts: message?.attempts ?? null,
      ...failureContext(message),
      errorClass: classification.code,
      retryable: classification.retryable,
      error: error.message,
      cause: serializeError(error.cause),
    };
    const logged =
      classification.severity === "platform"
        ? log.error("worker.job.failed", fields)
        : log.warn("worker.job.failed", fields);
    return Effect.as(logged, classification.retryable ? "retry" : "permanent");
  };
});
