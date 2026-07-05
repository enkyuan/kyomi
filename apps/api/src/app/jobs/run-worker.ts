import { env } from "@config/env";
import { db } from "@adapters/db/client";
import { assertDevelopmentDatabaseSchemaReady } from "@adapters/db/schema-guard";
import { logger } from "@adapters/logger";
import { closeRedis, getRedis } from "@adapters/redis";
import {
  consumeJobs,
  createHostRateLimiter,
  createRedisHostRateLimitStore,
  runFeedRefresh,
  shouldEnrichInsertedItems,
  type HostRateLimiter,
  type JobMessage,
} from "@kyomi/worker";
import { runOpmlImportFeedJob, runOpmlImportJob } from "@modules/opml/jobs";
import { classifyFeedRefreshError, isNonRetryableFeedRefreshFailure } from "./refresh-errors";

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
          enrichArticles: shouldEnrichInsertedItems(job.payload),
          hostRateLimiter,
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
      logger.info("worker.job.feed_refresh.completed", {
        streamId: id,
        feedId: job.payload.feedId,
        userId: job.payload.userId,
        ok: result.ok,
        notModified: result.notModified ?? false,
        itemCount: result.itemCount,
        insertedCount: result.insertedCount,
        updatedCount: result.updatedCount,
        categoryStats: result.categoryStats ?? null,
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

  const payload = {
    streamId: message?.id ?? null,
    jobType: message?.job.type ?? null,
    attempts: message?.attempts ?? null,
    ...feedRefreshContext,
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
