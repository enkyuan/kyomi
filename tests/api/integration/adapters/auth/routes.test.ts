import { afterEach, describe, expect, mock, test } from "bun:test";
import { Effect, Layer, ManagedRuntime } from "effect";
import { AUTH_CAPABILITIES_HEADER } from "@adapters/auth/capabilities";
import { authRoutes } from "@adapters/auth/routes";
import { Auth, type AuthShape } from "@adapters/auth/service";
import { Unauthorized } from "@shared/effect/errors";
import { Elysia, registerTestErrorHandlers } from "@api-tests/support/elysia";
import { testConfig } from "@api-tests/support/layers";

const runtimes: Array<{ dispose: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
});

/** The auth routes over a scripted `Auth`; error handlers first so they cover the routes. */
function appWith(auth: Partial<AuthShape>) {
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(
      testConfig(),
      Layer.succeed(
        Auth,
        Auth.of({
          handle: () => Effect.die("unused"),
          sessionUserId: () => Effect.die("unused"),
          listSessions: () => Effect.die("unused"),
          ...auth,
        }),
      ),
    ),
  );
  runtimes.push(runtime);
  const app = new Elysia();
  registerTestErrorHandlers(app);
  return app.use(authRoutes(runtime)) as unknown as { handle(request: Request): Promise<Response> };
}

describe("authRoutes", () => {
  test.each([
    ["exact auth route", "/api/auth"],
    ["wildcard auth route", "/api/auth/body-probe"],
  ])("preserves the raw request body for the %s", async (_, path) => {
    const payload = { path, probe: true };
    const handle = mock((request: Request) =>
      Effect.promise(async () => {
        const bodyWasUsed = request.bodyUsed;
        const body = await request.json();
        return Response.json(
          { bodyWasUsed, body },
          { headers: { "set-cookie": "session=probe; Path=/; HttpOnly" } },
        );
      }),
    );
    const app = appWith({ handle });

    const response = await app.handle(
      new Request(`http://localhost${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get(AUTH_CAPABILITIES_HEADER)).toContain("emailOtp");
    expect(response.headers.get("set-cookie")).toContain("session=probe");
    expect(await response.json()).toEqual({ bodyWasUsed: false, body: payload });
    expect(handle).toHaveBeenCalledTimes(1);
  });

  test("list-sessions answers from the Auth service", async () => {
    const listSessions = mock((_headers: Headers) => Effect.succeed([{ id: "s1" }] as never));
    const app = appWith({ listSessions });

    const response = await app.handle(
      new Request("http://localhost/api/auth/list-sessions", { headers: { cookie: "c=1" } }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: "s1" }]);
    expect(listSessions.mock.calls[0]?.[0].get("cookie")).toBe("c=1");
  });

  test("list-sessions without a session renders the 401 envelope", async () => {
    const app = appWith({
      listSessions: () => Effect.fail(new Unauthorized({ message: "Unauthorized" })),
    });

    const response = await app.handle(new Request("http://localhost/api/auth/list-sessions"));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { message: "Unauthorized", code: "UNAUTHORIZED" },
    });
  });
});
