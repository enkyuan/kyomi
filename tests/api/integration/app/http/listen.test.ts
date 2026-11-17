import { describe, expect, test } from "bun:test";
import { Effect, Exit, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { buildListenOptions, listenWithRetry } from "@app/http/listen";
import { recordingLogger } from "@api-tests/support/layers";

type App = Parameters<typeof listenWithRetry>[0];

describe("buildListenOptions", () => {
  test("forwards port and maxRequestBodySize", () => {
    expect(buildListenOptions({ port: 8000, maxRequestBodySize: 41_943_040 })).toEqual({
      port: 8000,
      maxRequestBodySize: 41_943_040,
    });
  });
});

/** An app whose `listen` throws `error` for the first `failures` calls. */
function fakeApp(failures: number, error: () => Error) {
  let calls = 0;
  const app = {
    listen() {
      calls += 1;
      if (calls <= failures) {
        throw error();
      }
      return app;
    },
  } as unknown as App;
  return { app, calls: () => calls };
}

const addressInUse = () =>
  Object.assign(new Error("Failed to start server"), { code: "EADDRINUSE" });

function run<A, E>(effect: Effect.Effect<A, E, never>) {
  return Effect.runPromiseExit(effect);
}

describe("listenWithRetry", () => {
  const options = { port: 8000, retries: 3, retryDelayMs: 250 };

  test("waits out a port that is still in use, logging each wait", async () => {
    const { app, calls } = fakeApp(2, addressInUse);
    const logs = recordingLogger();

    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(listenWithRetry(app, options));
        yield* TestClock.adjust("500 millis");
        return yield* Fiber.await(fiber);
      }).pipe(Effect.provide(logs.layer), Effect.provide(TestClock.layer())),
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(calls()).toBe(3);
    expect(logs.entries.map((entry) => entry.event)).toEqual([
      "server.port_in_use.retrying",
      "server.port_in_use.retrying",
    ]);
  });

  test("gives up after the configured retries", async () => {
    const { app, calls } = fakeApp(Number.POSITIVE_INFINITY, addressInUse);

    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(listenWithRetry(app, options));
        yield* TestClock.adjust("2 seconds");
        return yield* Fiber.await(fiber);
      }).pipe(Effect.provide(recordingLogger().layer), Effect.provide(TestClock.layer())),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(calls()).toBe(4);
  });

  test("does not retry any other failure", async () => {
    const { app, calls } = fakeApp(1, () => new Error("boom"));

    const exit = await run(
      listenWithRetry(app, options).pipe(Effect.provide(recordingLogger().layer)),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(calls()).toBe(1);
  });
});
