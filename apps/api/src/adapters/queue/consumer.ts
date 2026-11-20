import {
  Cause,
  Clock,
  Deferred,
  Duration,
  Effect,
  Fiber,
  FiberSet,
  Random,
  Result,
  Schedule,
} from "effect";
import {
  JOBS_CONSUMER_GROUP,
  JOBS_DEAD_LETTER_STREAM_KEY,
  ackEntry,
  claimPendingEntries,
  deadLetterJob,
  deadLetterRawEntry,
  ensureConsumerGroup,
  parseStreamEntry,
  promoteDueRetries,
  readNewEntries,
  scheduleRetry,
  type JobMessage,
  type StreamEntry,
  type StreamTarget,
} from "@kyomi/ingest";
import { AppLogger } from "@adapters/logger/service";
import { DEFAULT_RETRY_BACKOFF, retryDelayMs, type RetryBackoff } from "./backoff";
import { Redis, makeRedis, redisReplyCode } from "@adapters/redis/service";
import { BadRequest, InternalError, RedisError, unexpected } from "@shared/effect/errors";
import { errorMessage, serializeError } from "@shared/errors/serialize";

export type StreamConsumer<E extends { readonly message: string }> = {
  /** Unique consumer name inside the group. */
  readonly consumer: string;
  readonly streamKey: string;
  /** Entries read per XREADGROUP / XAUTOCLAIM. */
  readonly count: number;
  /** Maximum jobs in flight for this stream on this worker. */
  readonly concurrency: number;
  /** Keep long-lived feed handlers occupied across reads. Enable only for a stream whose
   * pending takeover threshold covers the lifetime of these overlapping jobs. */
  readonly refillWhileRunning?: boolean;
  readonly streamMaxLength: number;
  /** Entries pending longer than this are taken over from a consumer that died. */
  readonly pendingMinIdleMs?: number;
  /** How long one XREADGROUP blocks; bounds how quickly a stopped consumer notices. */
  readonly blockMs?: number;
  readonly maxAttempts?: number;
  /**
   * How long a failed job waits before its next attempt: a random delay up to 5s for the first
   * retry, doubling each time, never more than 5 minutes. It waits in a Redis sorted set beside the
   * stream and is put back once due, so a failing dependency is not hit again at once.
   */
  readonly retryBackoff?: RetryBackoff;
  readonly handle: (message: JobMessage) => Effect.Effect<void, E>;
  /**
   * Whether running the job again could succeed. A failure it rejects is dead-lettered at once,
   * with its error recorded, instead of being requeued: retrying a request that cannot succeed
   * only delays the dead-letter entry an operator has to act on. Defaults to retrying everything.
   */
  readonly isRetryable?: (error: E | InternalError) => boolean;
  /**
   * Called for every failure (a typed handler failure, a defect surfaced as `InternalError`, or
   * `BadRequest` for an entry that is not a job) so it can be logged. It never changes what
   * happens to the job. A failed job is retried after its backoff until `maxAttempts` is spent,
   * then goes to the dead-letter stream; `isRetryable` skips straight to the dead-letter stream. An
   * entry that is not a job is dead-lettered at once.
   */
  readonly onFailure: (
    error: E | BadRequest | InternalError,
    message: JobMessage | null,
  ) => Effect.Effect<void>;
};

const DEFAULT_PENDING_MIN_IDLE_MS = 10_000;
const DEFAULT_BLOCK_MS = 2_000;
const DEFAULT_MAX_ATTEMPTS = 3;
/** In-flight jobs get this long to finish after a stop request before they are interrupted. */
const DEFAULT_DRAIN_GRACE_MS = 8_000;

/** Back off 500ms, 1s, 2s ... up to 30s between attempts to recover a failing consumer. */
const RECOVERY_BACKOFF = Schedule.min([
  Schedule.exponential("500 millis"),
  Schedule.spaced("30 seconds"),
]);

const MAX_RECORDED_ERROR_LENGTH = 1_000;

/** What is stored for a failed job: no bound query values, and a bounded length. */
function failureText(error: { readonly message: string }): string {
  return errorMessage(error).slice(0, MAX_RECORDED_ERROR_LENGTH);
}

/** The failure to report for a handler's `Cause`; `undefined` when it only holds interruptions. */
function failureOf<E>(cause: Cause.Cause<E>): E | InternalError | undefined {
  const failure = Cause.findError(cause);
  if (Result.isSuccess(failure)) {
    return failure.success;
  }
  const defect = Cause.findDefect(cause);
  if (Result.isSuccess(defect)) {
    const reason = defect.success;
    return new InternalError({
      message: reason instanceof Error ? reason.message : "Unexpected job failure",
      cause: reason,
    });
  }
  return undefined;
}

/**
 * Consume one job stream until `stopping` completes. Each iteration claims abandoned entries or
 * reads new ones on a dedicated blocking connection, up to the number of free handler slots.
 * Redis failures are logged and retried with backoff (and never stop the other streams); a failing
 * job never fails the loop. After `stopping`, jobs already in hand drain before the loop returns.
 */
const consumeStream = <E extends { readonly message: string }>(
  options: StreamConsumer<E>,
  stopping: Deferred.Deferred<void>,
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const redis = yield* Redis;
      const log = yield* AppLogger;
      const target: StreamTarget = {
        streamKey: options.streamKey,
        group: JOBS_CONSUMER_GROUP,
        deadLetterStreamKey: JOBS_DEAD_LETTER_STREAM_KEY,
        streamMaxLength: options.streamMaxLength,
      };
      const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
      const backoff = options.retryBackoff ?? DEFAULT_RETRY_BACKOFF;
      const context = { streamKey: options.streamKey, consumer: options.consumer };

      // XREADGROUP BLOCK holds its connection, so reads get their own and never delay acks.
      const blocking = makeRedis(
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            // A blocking read waits on purpose, so it may take its block time plus the command
            // timeout; the timeout is only there to catch a read that never returns.
            const commandTimeout = redis.client.options.commandTimeout;
            const client = redis.client.duplicate(
              commandTimeout
                ? { commandTimeout: commandTimeout + (options.blockMs ?? DEFAULT_BLOCK_MS) }
                : {},
            );
            client.on("error", (error) => {
              Effect.runSync(
                log.error("redis.client.error", {
                  ...context,
                  role: "blocking",
                  error: error.message,
                }),
              );
            });
            return client;
          }),
          (client) => Effect.sync(() => client.disconnect()),
        ),
      );

      const isStopped = Deferred.isDone(stopping);
      const ensureGroup = redis.use("xgroup", (client) =>
        ensureConsumerGroup(client, JOBS_CONSUMER_GROUP, options.streamKey),
      );

      const nextEntries = (count: number) =>
        Effect.gen(function* () {
          const pending = yield* redis.use("xautoclaim", (client) =>
            claimPendingEntries(client, {
              streamKey: options.streamKey,
              group: JOBS_CONSUMER_GROUP,
              consumer: options.consumer,
              minIdleMs: options.pendingMinIdleMs ?? DEFAULT_PENDING_MIN_IDLE_MS,
              count,
            }),
          );
          if (pending.length > 0) {
            return pending;
          }
          return yield* blocking.use("xreadgroup", (client) =>
            readNewEntries(client, {
              streamKey: options.streamKey,
              group: JOBS_CONSUMER_GROUP,
              consumer: options.consumer,
              count,
              blockMs: options.blockMs ?? DEFAULT_BLOCK_MS,
            }),
          );
        });

      /** A Redis failure while settling leaves the entry pending, so it is delivered again. */
      const settle = (operation: string, id: string, run: Effect.Effect<void, RedisError>) =>
        run.pipe(
          Effect.catch((error) =>
            log.error("worker.job.settle_failed", {
              ...context,
              streamId: id,
              operation,
              error: serializeError(error.cause),
            }),
          ),
        );

      const ack = (id: string) =>
        settle(
          "xack",
          id,
          redis.use("xack", (client) => ackEntry(client, target, id)),
        );

      const settleFailure = (message: JobMessage, failure: E | InternalError) =>
        Effect.gen(function* () {
          yield* options.onFailure(failure, message);
          const text = failureText(failure);
          const retryable = options.isRetryable?.(failure) ?? true;
          if (retryable && message.attempts + 1 < maxAttempts) {
            const now = yield* Clock.currentTimeMillis;
            const delayMs = retryDelayMs(
              message.attempts + 1,
              yield* Random.nextBetween(0, 1),
              backoff,
            );
            yield* log.info("worker.job.retry_scheduled", {
              ...context,
              streamId: message.id,
              attempts: message.attempts + 1,
              delayMs,
            });
            return yield* settle(
              "retry",
              message.id,
              redis.use("retry", (client) =>
                scheduleRetry(client, target, message, text, now + delayMs),
              ),
            );
          }
          const now = new Date(yield* Clock.currentTimeMillis);
          return yield* settle(
            "dead_letter",
            message.id,
            redis.use("dead_letter", (client) => deadLetterJob(client, target, message, text, now)),
          );
        });

      const runJob = (message: JobMessage) =>
        Effect.matchCauseEffect(options.handle(message), {
          onSuccess: () => ack(message.id),
          onFailure: (cause) => {
            const failure = failureOf(cause);
            return failure === undefined ? Effect.interrupt : settleFailure(message, failure);
          },
        });

      const deadLetterInvalid = (entry: StreamEntry, error: BadRequest) =>
        Effect.gen(function* () {
          yield* options.onFailure(error, null);
          const now = new Date(yield* Clock.currentTimeMillis);
          yield* settle(
            "dead_letter",
            entry[0],
            redis.use("dead_letter", (client) =>
              deadLetterRawEntry(client, target, entry, failureText(error), now),
            ),
          );
        });

      const processEntry = (entry: StreamEntry) =>
        Effect.try({
          try: () => parseStreamEntry(entry),
          catch: (cause) =>
            new BadRequest({
              message: cause instanceof Error ? cause.message : "Invalid job",
              code: "INVALID_JOB",
              cause,
            }),
        }).pipe(
          Effect.matchEffect({
            onSuccess: runJob,
            onFailure: (error) => deadLetterInvalid(entry, error),
          }),
        );

      /** Failed jobs whose delay has passed go back on the stream, so the read below sees them. */
      const promoteRetries = Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        yield* redis.use("promote_retries", (client) => promoteDueRetries(client, target, now));
      });

      const active = yield* FiberSet.make<void>();
      const iteration = Effect.gen(function* () {
        // Only this reader adds jobs. Waiting on their completion observes the first free
        // slot without cancelling the other handlers or accumulating a local pending queue.
        const running = Array.from(active);
        if (running.length >= options.concurrency) {
          yield* Effect.raceAll(running.map((fiber) => Fiber.await(fiber)));
        }
        if (yield* isStopped) return;
        const remaining = options.concurrency - (yield* FiberSet.size(active));
        if (remaining < 1) return;
        yield* promoteRetries;
        const entries = yield* nextEntries(
          options.refillWhileRunning ? Math.min(options.count, remaining) : options.count,
        );
        if (!options.refillWhileRunning) {
          return yield* Effect.forEach(entries, processEntry, {
            concurrency: options.concurrency,
            discard: true,
          });
        }
        for (const entry of entries) {
          yield* FiberSet.run(
            active,
            processEntry(entry).pipe(
              Effect.catchDefect((defect) =>
                log.error("worker.job.settle_failed", {
                  ...context,
                  streamId: entry[0],
                  operation: "process",
                  error: serializeError(defect),
                }),
              ),
            ),
          );
        }
      }).pipe(
        // The group is gone when Redis lost its data; recreate it and carry on.
        Effect.catchIf(
          (error) => error.code === "NOGROUP",
          () => ensureGroup,
        ),
        Effect.catchDefect((defect) => Effect.fail(unexpected(defect))),
      );

      /** Retry `step` with backoff while the consumer is running. */
      const recover = <A>(step: Effect.Effect<A, RedisError | InternalError>) =>
        step.pipe(
          Effect.tapError((error) =>
            log.warn("worker.stream.recovering", {
              ...context,
              error: serializeError(error.cause),
            }),
          ),
          Effect.retry({
            schedule: RECOVERY_BACKOFF,
            while: () => Effect.map(isStopped, (stopped) => !stopped),
          }),
        );

      yield* log.info("worker.stream.started", context);
      yield* recover(ensureGroup).pipe(Effect.ignore);
      while (!(yield* isStopped)) {
        yield* recover(iteration).pipe(Effect.ignore);
      }
      yield* FiberSet.awaitEmpty(active);
      yield* log.info("worker.stream.stopped", context);
    }),
  );

/**
 * Fork one consumer per stream into the current scope. When the scope closes, consumers are asked
 * to stop, given `graceMs` to finish the jobs they are running, and interrupted if they are not
 * done by then (their entries stay pending and are claimed again after `pendingMinIdleMs`).
 */
export const startConsumers = <E extends { readonly message: string }>(
  consumers: ReadonlyArray<StreamConsumer<E>>,
  options: { readonly graceMs?: number } = {},
) =>
  Effect.gen(function* () {
    const log = yield* AppLogger;
    const graceMs = options.graceMs ?? DEFAULT_DRAIN_GRACE_MS;
    const stopping = yield* Deferred.make<void>();
    const fibers = yield* Effect.forEach(consumers, (consumer) =>
      Effect.forkScoped(consumeStream(consumer, stopping)),
    );
    // Registered after the forks, so it runs before the scope interrupts them.
    yield* Effect.addFinalizer(() =>
      Deferred.succeed(stopping, undefined).pipe(
        Effect.andThen(Effect.forEach(fibers, Fiber.await, { discard: true })),
        Effect.timeout(Duration.millis(graceMs)),
        Effect.catch(() => log.warn("worker.shutdown.drain_timeout", { graceMs })),
      ),
    );
  });
