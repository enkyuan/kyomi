import { afterAll, describe, expect, test } from "bun:test";
import { Effect, ManagedRuntime } from "effect";
import { CurrentUser, RequestContext } from "@shared/effect/request";
import { NotFound } from "@shared/effect/errors";
import { runEffect } from "@shared/http/effect/bridge";
import { EffectFailure } from "@shared/http/error/render";
import { AppConfig } from "@config/env/service";
import { testConfig } from "@api-tests/support/layers";

const runtime = ManagedRuntime.make(testConfig());
afterAll(() => runtime.dispose());

const request = (signal?: AbortSignal) =>
  new Request("http://localhost/api/v1/things?x=1", { method: "POST", signal });

describe("runEffect", () => {
  test("provides the request context and current user", async () => {
    const seen = await runEffect(
      { runtime, request: request(), requestId: "req-7", userId: "user-1" },
      Effect.gen(function* () {
        return { ctx: yield* RequestContext, user: yield* CurrentUser, config: yield* AppConfig };
      }),
    );

    expect(seen.ctx).toEqual({ requestId: "req-7", method: "POST", path: "/api/v1/things" });
    expect(seen.user).toEqual({ userId: "user-1" });
    expect(seen.config.NODE_ENV).toBe("test");
  });

  test("a typed failure throws EffectFailure with the catalogue status and code", async () => {
    const failure = await runEffect(
      { runtime, request: request(), requestId: "req-8" },
      Effect.fail(
        new NotFound({ message: "no such feed", code: "FEED_NOT_FOUND", details: { id: 1 } }),
      ),
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(EffectFailure);
    expect((failure as EffectFailure).rendered).toMatchObject({
      status: 404,
      code: "FEED_NOT_FOUND",
      message: "no such feed",
      details: { id: 1 },
      expected: true,
    });
  });

  test("a defect renders as an opaque 500", async () => {
    const failure = await runEffect(
      { runtime, request: request(), requestId: "req-9" },
      Effect.die(new Error("boom")),
    ).catch((error: unknown) => error);

    expect((failure as EffectFailure).rendered).toMatchObject({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Internal error",
      expected: false,
    });
  });

  test("aborting the request interrupts the running Effect", async () => {
    const controller = new AbortController();
    let finalized = false;
    const pending = runEffect(
      { runtime, request: request(controller.signal), requestId: "req-10" },
      Effect.never.pipe(Effect.ensuring(Effect.sync(() => (finalized = true)))),
    ).catch((error: unknown) => error);

    controller.abort();
    const failure = await pending;

    expect(finalized).toBe(true);
    expect((failure as EffectFailure).rendered).toMatchObject({ status: 499 });
  });
});
