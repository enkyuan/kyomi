import { afterEach, describe, expect, test } from "bun:test";
import { Effect, Layer, ManagedRuntime } from "effect";
import { requireAuth, resolveSessionContext } from "@adapters/auth/session";
import { Auth, type AuthShape } from "@adapters/auth/service";
import { EffectFailure } from "@shared/http/error/render";

/** An `Auth` whose session lookup is `sessionUserId`; the rest is not needed here. */
const authWith = (sessionUserId: AuthShape["sessionUserId"]) =>
  Layer.succeed(
    Auth,
    Auth.of({
      sessionUserId,
      handle: () => Effect.die("unused"),
      listSessions: () => Effect.die("unused"),
    }),
  );

describe("requireAuth", () => {
  test("returns the Better Auth user id from the resolved session", async () => {
    const headers = new Headers({ cookie: "better-auth.session_token=session-token" });
    const layer = authWith((requestHeaders) => {
      expect(requestHeaders).toBe(headers);
      return Effect.succeed("user_123");
    });

    const context = await Effect.runPromise(requireAuth(headers).pipe(Effect.provide(layer)));

    expect(context).toEqual({ userId: "user_123" });
  });

  test("binds offline replay to the authenticated account", async () => {
    const layer = authWith(() => Effect.succeed("second"));
    const headers = new Headers({ "x-kyomi-offline-owner": "first" });
    const error = await Effect.runPromise(
      Effect.flip(requireAuth(headers)).pipe(Effect.provide(layer)),
    );
    expect(error._tag).toBe("Unauthorized");
    headers.set("x-kyomi-offline-owner", "second");
    expect(await Effect.runPromise(requireAuth(headers).pipe(Effect.provide(layer)))).toEqual({
      userId: "second",
    });
  });

  test("fails with Unauthorized (401) when there is no session", async () => {
    const layer = authWith(() => Effect.succeed(null));

    const error = await Effect.runPromise(
      Effect.flip(requireAuth(new Headers())).pipe(Effect.provide(layer)),
    );

    expect(error).toMatchObject({
      _tag: "Unauthorized",
      message: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  });
});

describe("resolveSessionContext", () => {
  const runtimes: Array<{ dispose: () => Promise<void> }> = [];
  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
  });

  const runtimeWith = (sessionUserId: AuthShape["sessionUserId"]) => {
    const runtime = ManagedRuntime.make(authWith(sessionUserId));
    runtimes.push(runtime);
    return runtime;
  };

  test("returns the user id and the propagated request id, and echoes the id on the response", async () => {
    const runtime = runtimeWith(() => Effect.succeed("user_123"));
    const set = { headers: {} as Record<string, string | number | undefined> };
    const request = new Request("http://localhost/api/v1/folders", {
      headers: { "x-request-id": "req-42" },
    });

    const context = await resolveSessionContext(runtime, request, set);

    expect(context).toEqual({ userId: "user_123", requestId: "req-42" });
    expect(set.headers["x-request-id"]).toBe("req-42");
  });

  test("mints a request id when the caller sent none", async () => {
    const runtime = runtimeWith(() => Effect.succeed("user_123"));
    const set = { headers: {} as Record<string, string | number | undefined> };

    const { requestId } = await resolveSessionContext(
      runtime,
      new Request("http://localhost/api/v1/folders"),
      set,
    );

    expect(requestId.length).toBeGreaterThan(0);
    expect(set.headers["x-request-id"]).toBe(requestId);
  });

  test("an unauthenticated request throws a 401 failure for the error handler to render", async () => {
    const runtime = runtimeWith(() => Effect.succeed(null));

    const failure = await resolveSessionContext(
      runtime,
      new Request("http://localhost/api/v1/folders"),
      { headers: {} },
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(EffectFailure);
    expect((failure as EffectFailure).rendered).toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Unauthorized",
    });
  });
});
