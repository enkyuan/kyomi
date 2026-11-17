import { describe, expect, test } from "bun:test";
import { Effect, Exit } from "effect";
import { queueHealth } from "@modules/health/queue";
import { fakeRedis, replyError } from "@api-tests/support/layers";

const run = <A, E>(effect: Effect.Effect<A, E, never>) => Effect.runPromiseExit(effect);

describe("queue health snapshot", () => {
  test("reports refresh and OPML streams separately", async () => {
    const snapshot = await Effect.runPromise(
      queueHealth.pipe(
        Effect.provide(
          fakeRedis({
            xlen: async (stream: string) => (stream === "jobs:feed-refresh" ? 12 : 3),
            xpending: async () => [2, "1-0", "2-0", []],
          }),
        ),
      ),
    );

    expect(snapshot.streams["jobs:feed-refresh"]).toEqual({ length: 12, pending: 2 });
    expect(snapshot.streams["jobs:opml"]).toEqual({ length: 3, pending: 2 });
  });

  test("a stream whose consumer group does not exist has nothing pending", async () => {
    const snapshot = await Effect.runPromise(
      queueHealth.pipe(
        Effect.provide(
          fakeRedis({
            xlen: async () => 5,
            xpending: async () => {
              throw replyError("NOGROUP No such key 'jobs:opml' or consumer group 'workers'");
            },
          }),
        ),
      ),
    );

    expect(snapshot.streams["jobs:opml"]).toEqual({ length: 5, pending: 0 });
  });

  test("an xpending failure is an error, not zero pending", async () => {
    const exit = await run(
      queueHealth.pipe(
        Effect.provide(
          fakeRedis({
            xlen: async () => 5,
            xpending: async () => {
              throw new Error("Connection is closed.");
            },
          }),
        ),
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    const error = Exit.isFailure(exit) ? exit.cause.reasons[0] : undefined;
    expect(error?._tag).toBe("Fail");
    expect(error && "error" in error && (error.error as { _tag: string })._tag).toBe("RedisError");
  });

  test("a non-NOGROUP Redis reply error is not treated as an absent group", async () => {
    const exit = await run(
      queueHealth.pipe(
        Effect.provide(
          fakeRedis({
            xlen: async () => 5,
            xpending: async () => {
              throw replyError("WRONGTYPE Operation against a key holding the wrong kind of value");
            },
          }),
        ),
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });

  test("an unexpected xpending reply shape is an error", async () => {
    const exit = await run(
      queueHealth.pipe(
        Effect.provide(fakeRedis({ xlen: async () => 1, xpending: async () => "OK" })),
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });
});
