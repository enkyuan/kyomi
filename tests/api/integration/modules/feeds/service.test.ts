import { describe, expect, test } from "bun:test";
import { Deferred, Effect, ManagedRuntime } from "effect";
import { FeedBackground } from "@modules/feeds/service";

describe("FeedBackground", () => {
  test("a task outlives the request that scheduled it", async () => {
    const runtime = ManagedRuntime.make(FeedBackground.layer);
    const finished = await Effect.runPromise(Deferred.make<string>());

    // The "request": schedules the task and returns immediately.
    await runtime.runPromise(
      Effect.gen(function* () {
        const background = yield* FeedBackground;
        yield* background.run(
          Effect.sleep("10 millis").pipe(Effect.andThen(Deferred.succeed(finished, "done"))),
        );
      }),
    );

    expect(await Effect.runPromise(Deferred.await(finished))).toBe("done");
    await runtime.dispose();
  });

  test("disposing the runtime interrupts tasks that are still running", async () => {
    const runtime = ManagedRuntime.make(FeedBackground.layer);
    const started = await Effect.runPromise(Deferred.make<void>());
    const interrupted = await Effect.runPromise(Deferred.make<void>());

    await runtime.runPromise(
      Effect.gen(function* () {
        const background = yield* FeedBackground;
        yield* background.run(
          Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Effect.never),
            Effect.onInterrupt(() => Deferred.succeed(interrupted, undefined)),
          ),
        );
      }),
    );
    await Effect.runPromise(Deferred.await(started));
    await runtime.dispose();

    await expect(Effect.runPromise(Deferred.await(interrupted))).resolves.toBeUndefined();
  });
});
