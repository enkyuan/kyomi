import { afterEach, describe, expect, mock, test } from "bun:test";
import { Effect, Layer, ManagedRuntime } from "effect";
import { TestClock } from "effect/testing";
import { enforceRateLimitForContext, rateLimitPlugin } from "@adapters/rate-limit/plugin";
import { RateLimiter, type RateLimitRule } from "@adapters/rate-limit/service";
import { Elysia, registerTestErrorHandlers } from "@api-tests/support/elysia";
import { fakeRedis, recordingLogger, replyError } from "@api-tests/support/layers";

const RULE: RateLimitRule = { name: "test.bucket", max: 2, windowMs: 60_000 };

/** `RateLimiter` over a fake Redis whose `eval` runs `evalImpl`, with a clock the test controls. */
function limiter(evalImpl: (...args: unknown[]) => unknown) {
  const logs = recordingLogger();
  const layer = RateLimiter.layer.pipe(
    Layer.provide(Layer.mergeAll(fakeRedis({ eval: evalImpl }), logs.layer)),
    Layer.provideMerge(TestClock.layer()),
  );
  return { logs, layer };
}

const enforce = (subject: string, rule: RateLimitRule = RULE) =>
  RateLimiter.use((service) => service.enforce(subject, rule));

describe("RateLimiter", () => {
  test("counts the hit in Redis under a bucketed key and passes while within the limit", async () => {
    const evalMock = mock(async (..._args: unknown[]) => [1, 59_000]);
    const { layer } = limiter(evalMock);

    await Effect.runPromise(enforce(" user-1 ").pipe(Effect.provide(layer)));

    expect(evalMock.mock.calls[0]?.slice(1)).toEqual([
      1,
      "kyomi:rate-limit:test.bucket:user-1",
      "60000",
    ]);
  });

  test("fails with RateLimited (429) once the window's max is exceeded", async () => {
    const { layer } = limiter(async () => [3, 4_200]);

    const error = await Effect.runPromise(
      Effect.flip(enforce("user-1")).pipe(Effect.provide(layer)),
    );

    expect(error).toMatchObject({
      _tag: "RateLimited",
      code: "RATE_LIMITED",
      message: "Too many requests",
      details: { bucket: "test.bucket", retryAfterSeconds: 5 },
    });
  });

  test("a blank subject is an internal error, not a shared bucket", async () => {
    const { layer } = limiter(async () => [1, 1000]);

    const error = await Effect.runPromise(Effect.flip(enforce("   ")).pipe(Effect.provide(layer)));

    expect(error).toMatchObject({ _tag: "InternalError", code: "RATE_LIMIT_SUBJECT_MISSING" });
  });

  test("falls back to counting in memory when Redis fails, and logs it", async () => {
    const { layer, logs } = limiter(async () => {
      throw replyError("LOADING Redis is loading the dataset");
    });

    const program = Effect.gen(function* () {
      yield* enforce("user-1");
      yield* enforce("user-1");
      const third = yield* Effect.flip(enforce("user-1"));
      yield* TestClock.adjust("61 seconds");
      yield* enforce("user-1");
      return third;
    });
    const third = await Effect.runPromise(program.pipe(Effect.provide(layer)));

    expect(third).toMatchObject({ _tag: "RateLimited", details: { bucket: "test.bucket" } });
    expect(
      logs.entries.filter((entry) => entry.event === "rate_limit.redis_fallback"),
    ).toHaveLength(4);
  });
});

describe("rateLimitPlugin", () => {
  const runtimes: Array<{ dispose: () => Promise<void> }> = [];
  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
  });

  test("puts enforceRateLimit on the context and renders a denial as the 429 envelope", async () => {
    const runtime = ManagedRuntime.make(limiter(async () => [9, 30_000]).layer);
    runtimes.push(runtime);
    const app = new Elysia().use(rateLimitPlugin(runtime));
    registerTestErrorHandlers(app);
    const routed = app.get("/probe", (context) =>
      enforceRateLimitForContext(context, "user-1", RULE).then(() => "ok"),
    );

    const response = await (routed as unknown as { handle(r: Request): Promise<Response> }).handle(
      new Request("http://localhost/probe"),
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      error: {
        message: "Too many requests",
        code: "RATE_LIMITED",
        details: { bucket: "test.bucket", retryAfterSeconds: 30 },
      },
    });
  });

  test("enforceRateLimitForContext throws when the plugin is not registered", async () => {
    await expect(enforceRateLimitForContext({}, "user-1", RULE)).rejects.toThrow(
      "rateLimitPlugin must be registered",
    );
  });
});
