import { Cause, Clock, Deferred, Duration, Effect, Fiber, Result, Schedule } from "effect";
import {
  JOBS_CONSUMER_GROUP,
  JOBS_DEAD_LETTER_STREAM_KEY,
  ackEntry,
  claimPendingEntries,
  deadLetterJob,
  deadLetterRawEntry,
  ensureConsumerGroup,
  parseStreamEntry,
  readNewEntries,
  requeueJob,
  type JobMessage,
  type StreamEntry,
  type StreamTarget,
} from "@kyomi/ingest";
import { AppLogger } from "@adapters/logger/service";
import { Redis, makeRedis, redisReplyCode } from "@adapters/redis/service";
import { BadRequest, InternalError, RedisError, unexpected } from "@shared/effect/errors";
import { serializeError } from "@shared/errors/serialize";

export type StreamConsumer<E extends { readonly message: string }> = {
  /** Unique consumer name inside the group. */
  readonly consumer: string;
  readonly streamKey: string;
  /** Entries read per XREADGROUP / XAUTOCLAIM. */
  readonly count: number;
  /** Jobs from one batch that run at the same time. */
  readonly concurrency: number;
  readonly streamMaxLength: number;
  /** Entries pending longer than this are taken over from a consumer that died. */
  readonly pendingMinIdleMs?: number;
  /** How long one XREADGROUP blocks; bounds how quickly a stopped consumer notices. */
  readonly blockMs?: number;
  readonly maxAttempts?: number;
  readonly handle: (message: JobMessage) => Effect.Effect<void, E>;
  /**
   * Called for every failure (a typed handler failure, a defect surfaced as `InternalError`, or
   * `BadRequest` for an entry that is not a job) so it can be logged. It never changes what
   * happens to the job: a failed job goes back on the stream until `maxAttempts` is spent, then
   * to the dead-letter stream, whatever the error class. An entry that is not a job is
   * dead-lettered at once.
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

function failureText(error: { readonly message: string }): string {
  return error.message.slice(0, MAX_RECORDED_ERROR_LENGTH);
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
 * reads new ones on a dedicated blocking connection, then runs the batch with bounded concurrency.
 * Redis failures are logged and retried with backoff (and never stop the other streams); a failing
 * job never fails the loop. After `stopping`, the batch in hand finishes and the loop returns.
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
      const context = { streamKey: options.streamKey, consumer: options.consumer };

      // XREADGROUP BLOCK holds its connection, so reads get their own and never delay acks.
      const blocking = makeRedis(
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            const client = redis.client.duplicate();
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

      const nextEntries = Effect.gen(function* () {
        const pending = yield* redis.use("xautoclaim", (client) =>
          claimPendingEntries(client, {
            streamKey: options.streamKey,
            group: JOBS_CONSUMER_GROUP,
            consumer: options.consumer,
            minIdleMs: options.pendingMinIdleMs ?? DEFAULT_PENDING_MIN_IDLE_MS,
            count: options.count,
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
            count: options.count,
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
          if (message.attempts + 1 < maxAttempts) {
            return yield* settle(
              "requeue",
              message.id,
              redis.use("requeue", (client) => requeueJob(client, target, message, text)),
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

      const iteration = Effect.gen(function* () {
        const entries = yield* nextEntries;
        yield* Effect.forEach(entries, processEntry, {
          concurrency: options.concurrency,
          discard: true,
        });
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
