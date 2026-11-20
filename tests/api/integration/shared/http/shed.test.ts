import { describe, expect, test } from "bun:test";
import { Deferred, Effect, Fiber } from "effect";
import { makeLoadShedder } from "@shared/http/shed";

describe("makeLoadShedder", () => {
  test("refuses work beyond the limit instead of queueing it, and admits it again once room frees", async () => {
    const shed = makeLoadShedder("test", 2);

    await Effect.runPromise(
      Effect.gen(function* () {
        const release = yield* Deferred.make<void>();
        const held = () => shed(Deferred.await(release).pipe(Effect.as("done")));
        const first = yield* Effect.forkChild(held());
        const second = yield* Effect.forkChild(held());
        yield* Effect.yieldNow;

        const refused = yield* Effect.flip(shed(Effect.succeed("late")));
        expect(refused).toMatchObject({
          _tag: "RateLimited",
          code: "TOO_MANY_CONCURRENT_REQUESTS",
          details: { bucket: "test" },
        });

        yield* Deferred.succeed(release, undefined);
        expect(yield* Fiber.join(first)).toBe("done");
        expect(yield* Fiber.join(second)).toBe("done");
        expect(yield* shed(Effect.succeed("again"))).toBe("again");
      }),
    );
  });

  test("a failing effect frees its place", async () => {
    const shed = makeLoadShedder("test", 1);

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* Effect.flip(shed(Effect.fail("boom")));
        expect(yield* shed(Effect.succeed("ok"))).toBe("ok");
      }),
    );
  });
});
