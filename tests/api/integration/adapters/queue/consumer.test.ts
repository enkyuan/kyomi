import { describe, expect, test } from "bun:test";
import { Deferred, Effect, Exit, Fiber, Layer, Random, Scope } from "effect";
import { TestClock } from "effect/testing";
import { startConsumers, type StreamConsumer } from "@adapters/queue/consumer";
import { classifyJobFailure, toJobFailure, type JobFailure } from "@app/jobs/classify";
import { fakeRedis, recordingLogger, replyError } from "@api-tests/support/layers";
import { NotFound, Unavailable } from "@shared/effect/errors";

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
    promote?: () => unknown;
  } = {},
) {
  const state = {
    acked: [] as string[],
    transactions: [] as unknown[][][],
    /** The arguments of each EVAL that puts due retries back on the stream. */
    promotions: [] as unknown[][],
    /** The options each blocking client was duplicated with. */
    duplicateOptions: [] as unknown[],
    /** Which Redis reads happened, in order, to show retries are promoted before the read. */
    reads: [] as string[],
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
    xreadgroup: async (...args: unknown[]) => {
      state.reads.push("read");
      const next = batches.shift();
      if (next) {
        const count = Number(args[args.indexOf("COUNT") + 1]);
        const entries = next.slice(0, count);
        if (next.length > count) batches.unshift(next.slice(count));
        return [["stream", entries]];
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
    call: async (...args: unknown[]) => {
      state.reads.push("claim");
      const thrown = options.claim?.();
      if (thrown instanceof Error) {
        throw thrown;
      }
      return ["0-0", pending.splice(0, Number(args[args.indexOf("COUNT") + 1]))];
    },
    eval: async (...args: unknown[]) => {
      state.reads.push("promote");
      const thrown = options.promote?.();
      if (thrown instanceof Error) {
        throw thrown;
      }
      state.promotions.push(args);
      return 0;
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
        zadd: (...args: unknown[]) => (calls.push(["zadd", ...args]), chain),
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
    options: { commandTimeout: 5_000 },
    duplicate: (overrides: unknown) => {
      state.duplicateOptions.push(overrides);
      return blocking;
    },
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

/** The retry a failed job was parked as: when it is due and the job it will come back as. */
function scheduledRetry(transaction: unknown[][]) {
  const [command, key, dueAt, member] = transaction[0] as [string, string, number, string];
  expect(command).toBe("zadd");
  const { id, fields: flat } = JSON.parse(member) as { id: string; fields: string[] };
  const fields: Record<string, string> = {};
  for (let i = 0; i < flat.length; i += 2) {
    fields[flat[i]!] = flat[i + 1]!;
  }
  return { key, dueAt, id, fields };
}

function consumer(
  overrides: Partial<StreamConsumer<JobFailure>> & Pick<StreamConsumer<JobFailure>, "handle">,
): StreamConsumer<JobFailure> {
  return {
    consumer: "c1",
    streamKey: "jobs:feed-refresh",
    count: 10,
    concurrency: 2,
    refillWhileRunning: true,
    streamMaxLength: 5_000,
    blockMs: 5,
    onFailure: () => Effect.void,
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
  options: { graceMs?: number; random?: number } = {},
) {
  const logs = recordingLogger();
  const result = Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        yield* startConsumers(consumers, { graceMs: options.graceMs });
        yield* Effect.promise(() => waitFor(done, "consumer progress"));
      }),
    ).pipe(
      // A fixed draw from the random service makes the backoff delay exact.
      Effect.provideService(Random.Random, {
        nextIntUnsafe: () => 0,
        nextDoubleUnsafe: () => options.random ?? Math.random(),
      }),
      Effect.provide(Layer.mergeAll(redis.layer, logs.layer)),
    ),
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

  test("refills a free slot while a slower job from the previous read is still running", async () => {
    const redis = streamRedis({
      batches: [[refreshEntry("1-0"), refreshEntry("2-0")], [refreshEntry("3-0")]],
    });
    const release = Promise.withResolvers<void>();
    let running = 0;
    let peak = 0;
    const { result } = runUntil(
      [
        consumer({
          concurrency: 2,
          handle: (message) =>
            Effect.promise(async () => {
              peak = Math.max(peak, ++running);
              if (message.id === "1-0") await release.promise;
              running--;
            }),
        }),
      ],
      redis,
      () => redis.state.acked.length === 3,
    );
    try {
      await waitFor(
        () => redis.state.acked.includes("3-0"),
        "the next batch before the slow publisher",
      );
      expect(redis.state.acked).not.toContain("1-0");
      expect(peak).toBe(2);
    } finally {
      release.resolve();
      await result;
    }
  });

  test("a retryable failure waits in the retry set with its error recorded as last_error", async () => {
    const redis = streamRedis({ batches: [[refreshEntry("1-0")]] });

    const { result } = runUntil(
      [
        consumer({
          handle: () =>
            Effect.fail(new Unavailable({ message: "upstream down", code: "UPSTREAM" })),
        }),
      ],
      redis,
      () => redis.state.transactions.length === 1,
    );
    await result;

    const retry = scheduledRetry(redis.state.transactions[0]!);
    expect(retry.key).toBe("jobs:feed-refresh:retry");
    expect(retry.id).toBe("1-0");
    expect(retry.fields).toMatchObject({ attempts: "1", last_error: "upstream down" });
    // Parked and acknowledged together, and never put straight back on the stream.
    expect(redis.state.transactions[0]![1]![0]).toBe("xack");
    expect(redis.state.transactions[0]!.some(([command]) => command === "xadd")).toBe(false);
  });

  test("a retry is due after a random share of its backoff, which doubles and is capped", async () => {
    /** How long after the failure the retry was scheduled to come back, for a draw of `random`. */
    const delayFor = async (
      entry: Entry,
      retryBackoff: { baseMs: number; maxMs: number },
      random: number,
    ) => {
      const redis = streamRedis({ batches: [[entry]] });
      const before = Date.now();
      await runUntil(
        [
          consumer({
            retryBackoff,
            handle: () => Effect.fail(new Unavailable({ message: "down", code: "UPSTREAM" })),
          }),
        ],
        redis,
        () => redis.state.transactions.length === 1,
        { random },
      ).result;
      const { dueAt } = scheduledRetry(redis.state.transactions[0]!);
      const after = Date.now();
      return { min: dueAt - after, max: dueAt - before };
    };
    const within = (waited: { min: number; max: number }, expected: number) => {
      expect(waited.min).toBeLessThanOrEqual(expected);
      expect(waited.max).toBeGreaterThanOrEqual(expected);
    };

    // The first retry waits a share of the base; a draw of 0 means no wait at all.
    within(await delayFor(refreshEntry("1-0"), { baseMs: 40_000, maxMs: 1_000_000 }, 0.5), 20_000);
    within(await delayFor(refreshEntry("2-0"), { baseMs: 40_000, maxMs: 1_000_000 }, 0), 0);
    // The second retry's window is twice as long, and neither goes past the cap.
    within(
      await delayFor(entryWithAttempts("3-0", 1), { baseMs: 40_000, maxMs: 1_000_000 }, 0.5),
      40_000,
    );
    within(
      await delayFor(entryWithAttempts("4-0", 1), { baseMs: 40_000, maxMs: 50_000 }, 0.5),
      25_000,
    );
  });

  test("the blocking client may wait out its block time on top of the command timeout", async () => {
    const redis = streamRedis({ batches: [[refreshEntry("1-0")]] });

    await runUntil(
      [consumer({ blockMs: 2_000, handle: () => Effect.void })],
      redis,
      () => redis.state.acked.length === 1,
    ).result;

    // The shared client times a command out after 5s; a read that blocks for 2s must not.
    expect(redis.state.duplicateOptions).toEqual([{ commandTimeout: 7_000 }]);
  });

  test("retries that are due are put back on the stream before each read", async () => {
    const redis = streamRedis({ batches: [[refreshEntry("1-0")]] });

    await runUntil(
      [consumer({ handle: () => Effect.void })],
      redis,
      () => redis.state.acked.length === 1,
    ).result;

    expect(redis.state.reads.slice(0, 3)).toEqual(["promote", "claim", "read"]);
    const [script, keyCount, retryKey, streamKey, now, maxLength, limit] = redis.state
      .promotions[0] as [string, number, string, string, string, string, string];
    expect(script).toContain("ZRANGEBYSCORE");
    expect([keyCount, retryKey, streamKey]).toEqual([
      2,
      "jobs:feed-refresh:retry",
      "jobs:feed-refresh",
    ]);
    expect(Number(now)).toBeGreaterThan(0);
    expect([maxLength, limit]).toEqual(["5000", "100"]);
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

  test("a permanent failure is dead-lettered at once, never retried or dropped", async () => {
    const failures: string[] = [];
    const redis = streamRedis({ batches: [[refreshEntry("1-0")]] });

    await runUntil(
      [
        consumer({
          handle: () =>
            Effect.fail(new NotFound({ message: "Article not found", code: "ARTICLE_NOT_FOUND" })),
          isRetryable: (error) => classifyJobFailure(error).retryable,
          onFailure: (error) => {
            failures.push(error._tag);
            return Effect.void;
          },
        }),
      ],
      redis,
      () => redis.state.transactions.length === 1,
    ).result;

    expect(movedTo(redis.state.transactions[0]!)).toMatchObject({
      stream: "jobs:dead-letter",
      fields: { attempts: "1", error: "Article not found", original_stream_id: "1-0" },
    });
    expect(failures).toEqual(["NotFound"]);
    expect(redis.state.acked).toEqual([]);
  });

  test("a retryable failure is still retried when the consumer classifies failures", async () => {
    const redis = streamRedis({ batches: [[refreshEntry("1-0")]] });

    await runUntil(
      [
        consumer({
          handle: () => Effect.fail(new Unavailable({ message: "later", code: "UPSTREAM" })),
          isRetryable: (error) => classifyJobFailure(error).retryable,
        }),
      ],
      redis,
      () => redis.state.transactions.length === 1,
    ).result;

    expect(scheduledRetry(redis.state.transactions[0]!)).toMatchObject({
      key: "jobs:feed-refresh:retry",
      fields: { attempts: "1", last_error: "later" },
    });
  });

  test("without a classifier a deterministic failure is retried and dead-lettered like any other, never dropped", async () => {
    const failures: string[] = [];
    const handle = () =>
      Effect.fail(new NotFound({ message: "Article not found", code: "ARTICLE_NOT_FOUND" }));
    const onFailure = (error: { _tag: string }) => {
      failures.push(error._tag);
      return Effect.void;
    };

    const first = streamRedis({ batches: [[refreshEntry("1-0")]] });
    await runUntil(
      [consumer({ handle, onFailure })],
      first,
      () => first.state.transactions.length === 1,
    ).result;
    expect(scheduledRetry(first.state.transactions[0]!)).toMatchObject({
      key: "jobs:feed-refresh:retry",
      fields: { attempts: "1", last_error: "Article not found" },
    });

    const last = streamRedis({ batches: [[entryWithAttempts("2-0", 2)]] });
    await runUntil(
      [consumer({ handle, onFailure })],
      last,
      () => last.state.transactions.length === 1,
    ).result;
    expect(movedTo(last.state.transactions[0]!)).toMatchObject({
      stream: "jobs:dead-letter",
      fields: { attempts: "3", error: "Article not found", original_stream_id: "2-0" },
    });

    expect(failures).toEqual(["NotFound", "NotFound"]);
    expect(first.state.acked).toEqual([]);
    expect(last.state.acked).toEqual([]);
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

    expect(scheduledRetry(redis.state.transactions[0]!).fields.last_error).toBe(
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
            return Effect.void;
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
  test("while promoting retries is logged and retried, and the loop carries on", async () => {
    let down = true;
    const redis = streamRedis({
      batches: [[refreshEntry("1-0")]],
      promote: () => (down ? new Error("Connection is closed.") : undefined),
    });
    const logs = recordingLogger();

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* startConsumers([consumer({ handle: () => Effect.void })]);
          yield* Effect.promise(() =>
            waitFor(
              () => logs.entries.some((entry) => entry.event === "worker.stream.recovering"),
              "promotion failure to be logged",
            ),
          );
          expect(redis.state.acked).toEqual([]);

          down = false;
          yield* TestClock.adjust("40 seconds");
          yield* Effect.promise(() => waitFor(() => redis.state.acked.length === 1, "recovery"));
        }).pipe(Effect.provide(Layer.mergeAll(redis.layer, logs.layer, TestClock.layer()))),
      ),
    );
  });

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
