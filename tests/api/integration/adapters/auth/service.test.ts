import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { Auth } from "@adapters/auth/service";
import { AppConfig } from "@config/env/service";
import { scriptedHttpClient } from "@api-tests/support/http";
import { fakeDb, silentLogger, testConfig } from "@api-tests/support/layers";

/** The real `Auth` layer: Better Auth built from test config over a fake database. */
const layer = Auth.layer.pipe(
  Layer.provide(
    Layer.mergeAll(
      testConfig(),
      fakeDb(),
      silentLogger,
      scriptedHttpClient(() => new Error("no network in this test")),
    ),
  ),
);

const run = <A, E>(effect: Effect.Effect<A, E, Auth>) =>
  Effect.runPromise(Effect.scoped(effect.pipe(Effect.provide(layer))) as Effect.Effect<A, E>);

describe("Auth layer", () => {
  test("builds Better Auth from AppConfig and serves its HTTP surface", async () => {
    const response = await run(
      Auth.use((auth) => auth.handle(new Request("http://localhost:8000/api/auth/ok"))),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  test("a request with no session cookie has no user id", async () => {
    // Better Auth answers "no session" without touching the database when there is no cookie.
    const userId = await run(Auth.use((auth) => auth.sessionUserId(new Headers())));

    expect(userId).toBeNull();
  });

  test("credentials missing for an enabled provider fail the layer with ConfigError", async () => {
    // Env validation rejects this first in production; here the config is built past it.
    const inconsistent = Layer.effect(
      AppConfig,
      AppConfig.use((config) =>
        Effect.succeed(AppConfig.of({ ...config, FEATURE_GOOGLE_OAUTH: true })),
      ).pipe(Effect.provide(testConfig())),
    );
    const broken = Auth.layer.pipe(
      Layer.provide(
        Layer.mergeAll(
          inconsistent,
          fakeDb(),
          silentLogger,
          scriptedHttpClient(() => new Error("unused")),
        ),
      ),
    );

    const error = await Effect.runPromise(Effect.flip(Effect.scoped(Layer.build(broken))));

    expect(error).toMatchObject({ _tag: "ConfigError", message: "Invalid auth configuration" });
  });
});
