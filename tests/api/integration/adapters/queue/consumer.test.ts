import { describe, expect, test } from "bun:test";
import { Deferred, Effect, Exit, Fiber, Layer, Scope } from "effect";
import { TestClock } from "effect/testing";
import { startConsumers, type StreamConsumer } from "@adapters/queue/consumer";
import { classifyJobFailure, toJobFailure, type JobFailure } from "@app/jobs/classify";
import { fakeRedis, recordingLogger, replyError } from "@api-tests/support/layers";
import { AppError } from "@shared/errors/app";

type Entry = [string, string[]];

const refreshEntry = (id: string): Entry => [
  id,
  ["type", "feed.refresh", "payload", JSON.stringify({ feedId: `feed-${id}`, userId: "system" })],
];
const entryWithAttempts = (id: string, attempts: number): Entry => {
  const [, fields] = refreshEntry(id);
  return [id, [...fields, "attempts", String(attempts)]];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** An in-memory stand-in for the Redis commands the consumer uses. */
function streamRedis(
  options: {
    pending?: Entry[];
    batches?: Entry[][];
    claim?: () => unknown;
    ack?: (id: string) => unknown;
  } = {},
) {
  const state = {
    acked: [] as string[],
    transactions: [] as unknown[][][],
    groups: 0,
    blockingClosed: false,
  };
  const pending = [...(options.pending ?? [])];
  const batches = [...(options.batches ?? [])];

  const blocking = {
    on: () => undefined,
    disconnect: () => {
      state.blockingClosed = true;
    },
    xreadgroup: async () => {
      const next = batches.shift();
      if (next) {
        return [["stream", next]];
      }
      await sleep(5);
      return null;
    },
  };
  const commands = {
    xgroup: async () => {
      state.groups += 1;
      return "OK";
    },
    call: async () => {
      const thrown = options.claim?.();
      if (thrown instanceof Error) {
        throw thrown;
      }
      return ["0-0", pending.splice(0)];
    },
    xack: async (_stream: string, _group: string, id: string) => {
      const thrown = options.ack?.(id);
      if (thrown instanceof Error) {
        throw thrown;
      }
      state.acked.push(id);
      return 1;
    },
    multi: () => {
      const calls: unknown[][] = [];
      const chain = {
        xadd: (...args: unknown[]) => (calls.push(["xadd", ...args]), chain),
        xack: (...args: unknown[]) => (calls.push(["xack", ...args]), chain),
        exec: async () => {
          state.transactions.push(calls);
          return [
            [null, "1-0"],
            [null, 1],
          ];
        },
      };
      return chain;
    },
    duplicate: () => blocking,
  };
  return { state, layer: fakeRedis(commands) };
}

/** The destination stream and flat fields of a recorded transaction's XADD. */
function movedTo(transaction: unknown[][]) {
  const [, stream, , , , , ...flat] = transaction[0] as [string, string, ...string[]];
  const fields: Record<string, string> = {};
  for (let i = 0; i < flat.length; i += 2) {
    fields[flat[i]!] = flat[i + 1]!;
  }
  return { stream, fields };
}

function consumer(
  overrides: Partial<StreamConsumer<JobFailure>> & Pick<StreamConsumer<JobFailure>, "handle">,
): StreamConsumer<JobFailure> {
  return {
    consumer: "c1",
    streamKey: "jobs:feed-refresh",
    count: 10,
    concurrency: 2,
    streamMaxLength: 5_000,
    blockMs: 5,
    onFailure: (error) =>
      Effect.succeed(classifyJobFailure(error).retryable ? "retry" : "permanent"),
    ...overrides,
  };
}

async function waitFor(condition: () => boolean, what: string) {
  for (let i = 0; i < 400; i += 1) {
    if (condition()) {
      return;
    }
    await sleep(5);
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** Run consumers until `done()`, then close the scope (which drains them). */
function runUntil(
  consumers: StreamConsumer<JobFailure>[],
  redis: ReturnType<typeof streamRedis>,
  done: () => boolean,
  options: { graceMs?: number } = {},
) {
  const logs = recordingLogger();
  const result = Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        yield* startConsumers(consumers, options);
        yield* Effect.promise(() => waitFor(done, "consumer progress"));
      }),
    ).pipe(Effect.provide(Layer.mergeAll(redis.layer, logs.layer))),
  );
  return { logs, result };
}

describe("startConsumers", () => {
  test("runs every claimed and newly read job and acknowledges it", async () => {
    const redis = streamRedis({ pending: [refreshEntry("1-0")], batches: [[refreshEntry("2-0")]] });
    const seen: string[] = [];

    const { result } = runUntil(
      [consumer({ handle: (message) => Effect.sync(() => void seen.push(message.id)) })],
      redis,
      () => redis.state.acked.length === 2,
    );
    await result;

    expect(seen.sort()).toEqual(["1-0", "2-0"]);
    expect(redis.state.acked.sort()).toEqual(["1-0", "2-0"]);
    expect(redis.state.groups).toBe(1);
    expect(redis.state.blockingClosed).toBe(true);
  });

  test("a retryable failure goes back on the stream with its error recorded as last_error", async () => {
    const redis = streamRedis({ batches: [[refreshEntry("1-0")]] });

    const { result } = runUntil(
      [
        consumer({
          handle: () =>
            Effect.fail(
              toJobFailure(new AppError("upstream down", { status: 503, code: "UPSTREAM" })),
            ),
        }),
      ],
      redis,
      () => redis.state.transactions.length === 1,
    );
    await result;

    const moved = movedTo(redis.state.transactions[0]!);
    expect(moved.stream).toBe("jobs:feed-refresh");
    expect(moved.fields).toMatchObject({ attempts: "1", last_error: "upstream down" });
    expect(redis.state.transactions[0]![1]![0]).toBe("xack");
  });

  test("the last retryable failure is dead-lettered with the error the replay listing shows", async () => {
    const redis = streamRedis({ batches: [[entryWithAttempts("1-0", 2)]] });

    const { result } = runUntil(
      [consumer({ handle: () => Effect.fail(toJobFailure(new Error("connection terminated"))) })],
      redis,
      () => redis.state.transactions.length === 1,
    );
    await result;

    const moved = movedTo(redis.state.transactions[0]!);
    expect(moved.stream).toBe("jobs:dead-letter");
    expect(moved.fields).toMatchObject({
      attempts: "3",
      error: "connection terminated",
      last_error: "connection terminated",
      original_stream_id: "1-0",
    });
  });

  test("a deterministic failure is acknowledged without being retried", async () => {
    const redis = streamRedis({ batches: [[refreshEntry("1-0")]] });
    const failures: string[] = [];

    const { result } = runUntil(
      [
        consumer({
          handle: () =>
            Effect.fail(
              toJobFailure(
                new AppError("Article not found", { status: 404, code: "ARTICLE_NOT_FOUND" }),
              ),
            ),
          onFailure: (error) => {
            failures.push(error._tag);
            return Effect.succeed("permanent");
          },
        }),
      ],
      redis,
      () => redis.state.acked.length === 1,
    );
    await result;

    expect(failures).toEqual(["NotFound"]);
    expect(redis.state.transactions).toEqual([]);
  });

  test("a defect in a handler is a retryable failure, not a crash", async () => {
    const redis = streamRedis({ batches: [[refreshEntry("1-0")]] });

    const { result } = runUntil(
      [
        consumer({
          handle: () =>
            Effect.sync(() => {
              throw new TypeError("undefined is not a function");
            }),
        }),
      ],
      redis,
      () => redis.state.transactions.length === 1,
    );
    await result;

    expect(movedTo(redis.state.transactions[0]!).fields.last_error).toBe(
      "undefined is not a function",
    );
  });

  test("an entry that is not a job is dead-lettered with its raw fields", async () => {
    const redis = streamRedis({ batches: [[["9-0", ["type", "mystery", "payload", "{}"]]]] });
    const reported: Array<[string, string | null]> = [];

    const { result } = runUntil(
      [
        consumer({
          handle: () => Effect.void,
          onFailure: (error, message) => {
            reported.push([error._tag, message?.id ?? null]);
            return Effect.succeed("retry");
          },
        }),
      ],
      redis,
      () => redis.state.transactions.length === 1,
    );
    await result;

    expect(reported).toEqual([["BadRequest", null]]);
    expect(movedTo(redis.state.transactions[0]!)).toMatchObject({
      stream: "jobs:dead-letter",
      fields: { type: "mystery", error: "Unsupported job type: mystery" },
    });
  });

  test("a failing acknowledgement is logged and the next job still runs", async () => {
    const redis = streamRedis({
      batches: [[refreshEntry("1-0"), refreshEntry("2-0")]],
      ack: (id) =>
        id === "1-0"
          ? new Error("READONLY You can't write against a read only replica")
          : undefined,
    });

    const { result, logs } = runUntil(
      [consumer({ concurrency: 1, handle: () => Effect.void })],
      redis,
      () => redis.state.acked.includes("2-0"),
    );
    await result;

    expect(redis.state.acked).toEqual(["2-0"]);
    expect(logs.entries).toContainEqual(
      expect.objectContaining({
        level: "error",
        event: "worker.job.settle_failed",
        context: expect.objectContaining({ streamId: "1-0", operation: "xack" }),
      }),
    );
  });

  test("recreates a missing consumer group and keeps going", async () => {
    let claims = 0;
    const redis = streamRedis({
      batches: [[refreshEntry("1-0")]],
      claim: () => (++claims === 1 ? replyError("NOGROUP No such consumer group") : undefined),
    });

    const { result } = runUntil(
      [consumer({ handle: () => Effect.void })],
      redis,
      () => redis.state.acked.length === 1,
    );
    await result;

    expect(redis.state.groups).toBe(2);
  });
});

describe("a Redis outage", () => {
  test("is retried with backoff and consuming resumes, without stopping the other stream", async () => {
    let down = true;
    const healthy = streamRedis({ batches: [[refreshEntry("1-0")]] });
    const flaky = streamRedis({
      batches: [[refreshEntry("5-0")]],
      claim: () => (down ? new Error("Connection is closed.") : undefined),
    });
    const logs = recordingLogger();
    const handled: string[] = [];
    const handle = (message: { id: string }) => Effect.sync(() => void handled.push(message.id));

    // Each stream gets its own client in production; here two fake clients stand in for them.
    await Effect.runPromise(
      Effect.gen(function* () {
        const healthyScope = yield* Scope.make();
        const flakyScope = yield* Scope.make();
        yield* startConsumers([consumer({ consumer: "ok", handle })]).pipe(
          Effect.provide(Layer.mergeAll(healthy.layer, logs.layer)),
          Scope.provide(healthyScope),
        );
        yield* startConsumers([consumer({ consumer: "bad", handle })]).pipe(
          Effect.provide(Layer.mergeAll(flaky.layer, logs.layer)),
          Scope.provide(flakyScope),
        );

        yield* Effect.promise(() =>
          waitFor(() => healthy.state.acked.length === 1, "healthy stream"),
        );
        expect(flaky.state.acked).toEqual([]);
        expect(
          logs.entries.filter((entry) => entry.event === "worker.stream.recovering").length,
        ).toBeGreaterThan(0);

        down = false;
        yield* TestClock.adjust("40 seconds");
        yield* Effect.promise(() =>
          waitFor(() => flaky.state.acked.length === 1, "recovered stream"),
        );

        yield* Scope.close(healthyScope, Exit.void);
        yield* Scope.close(flakyScope, Exit.void);
      }).pipe(Effect.provide(TestClock.layer())),
    );

    expect(handled.sort()).toEqual(["1-0", "5-0"]);
  });
});

describe("shutdown", () => {
  test("a job in flight finishes and is acknowledged before the scope closes", async () => {
    const redis = streamRedis({ batches: [[refreshEntry("1-0")]] });
    const logs = recordingLogger();

    const outcome = await Effect.runPromise(
      Effect.gen(function* () {
        const scope = yield* Scope.make();
        const started = yield* Deferred.make<void>();
        const release = yield* Deferred.make<void>();
        yield* startConsumers([
          consumer({
            handle: () =>
              Deferred.succeed(started, undefined).pipe(Effect.andThen(Deferred.await(release))),
          }),
        ]).pipe(Scope.provide(scope));

        yield* Deferred.await(started);
        const closing = yield* Effect.forkChild(Scope.close(scope, Exit.void));
        yield* Effect.sleep("50 millis");
        const closedWhileRunning = closing.pollUnsafe() !== undefined;
        yield* Deferred.succeed(release, undefined);
        yield* Fiber.join(closing);
        return { closedWhileRunning, acked: [...redis.state.acked] };
      }).pipe(Effect.provide(Layer.mergeAll(redis.layer, logs.layer))),
    );

    expect(outcome.closedWhileRunning).toBe(false);
    expect(outcome.acked).toEqual(["1-0"]);
    expect(redis.state.blockingClosed).toBe(true);
  });

  test("a job that outlasts the grace period is interrupted and stays pending", async () => {
    const redis = streamRedis({ batches: [[refreshEntry("1-0")]] });
    const logs = recordingLogger();
    let interrupted = false;

    await Effect.runPromise(
      Effect.gen(function* () {
        const scope = yield* Scope.make();
        const started = yield* Deferred.make<void>();
        yield* startConsumers(
          [
            consumer({
              handle: () =>
                Deferred.succeed(started, undefined).pipe(
                  Effect.andThen(Effect.never),
                  Effect.onInterrupt(() => Effect.sync(() => void (interrupted = true))),
                ),
            }),
          ],
          { graceMs: 1_000 },
        ).pipe(Scope.provide(scope));

        yield* Deferred.await(started);
        const closing = yield* Effect.forkChild(Scope.close(scope, Exit.void));
        yield* TestClock.adjust("2 seconds");
        yield* Fiber.join(closing);
      }).pipe(Effect.provide(Layer.mergeAll(redis.layer, logs.layer, TestClock.layer()))),
    );

    expect(interrupted).toBe(true);
    expect(redis.state.acked).toEqual([]);
    expect(logs.entries.some((entry) => entry.event === "worker.shutdown.drain_timeout")).toBe(
      true,
    );
  });
});
