import { Effect, Layer } from "effect";
import { FEED_REFRESH_JOBS_STREAM_KEY } from "@kyomi/ingest";
import { developmentSchemaReady } from "@adapters/db/guard";
import { AppLogger } from "@adapters/logger/service";
import { startConsumers, type StreamConsumer } from "@adapters/queue/consumer";
import { AppConfig } from "@config/env/service";
import { classifyJobFailure, type JobFailure } from "./classify";
import { makeFailureReporter, makeJobHandler } from "./handler";
import { shutdownWindows } from "./shutdown";

/**
 * The job worker: one consumer fiber per stream in `JOB_STREAMS`, owned by this layer's scope.
 * Building the layer starts them; releasing it (SIGTERM, runtime disposal) stops reading, lets
 * running jobs finish within the drain window, then interrupts what is left (`shutdown.ts` splits
 * `SHUTDOWN_BUDGET_MS` into those windows).
 */
export const WorkerLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const config = yield* AppConfig;
    const log = yield* AppLogger;
    yield* developmentSchemaReady;

    const handle = yield* makeJobHandler;
    const onFailure = yield* makeFailureReporter;
    const consumerPrefix = `api-worker-${crypto.randomUUID()}`;

    const consumers = config.JOB_STREAMS.map(
      (streamKey): StreamConsumer<JobFailure> => ({
        consumer: `${consumerPrefix}-${streamKey.replace(/[^a-z0-9-]/gi, "-")}`,
        streamKey,
        // Refresh jobs run long, so an entry is only taken over after its running lease expires.
        pendingMinIdleMs:
          streamKey === FEED_REFRESH_JOBS_STREAM_KEY
            ? config.FEED_REFRESH_RUNNING_LEASE_MS
            : undefined,
        refillWhileRunning: streamKey === FEED_REFRESH_JOBS_STREAM_KEY,
        count: config.JOB_READ_COUNT,
        concurrency: config.JOB_PROCESS_CONCURRENCY,
        streamMaxLength: config.JOB_STREAM_MAX_LENGTH,
        handle,
        isRetryable: (error) => classifyJobFailure(error).retryable,
        onFailure,
      }),
    );

    yield* log.info("worker.started", { consumer: consumerPrefix, streams: config.JOB_STREAMS });
    // Registered before the consumers, so it runs after they have drained.
    yield* Effect.addFinalizer(() => log.info("worker.stopped", { consumer: consumerPrefix }));
    yield* startConsumers(consumers, {
      graceMs: shutdownWindows(config.SHUTDOWN_BUDGET_MS).drainMs,
    });
  }),
);
