import { afterEach, describe, expect, test } from "bun:test";
import { Layer, ManagedRuntime } from "effect";
import { registerUserRoutes } from "@modules/users/routes";
import { Elysia, registerTestErrorHandlers } from "@api-tests/support/elysia";
import { fakeDb } from "@api-tests/support/layers";

const runtimes: Array<{ dispose: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
});

function appWith(client: Parameters<typeof fakeDb>[0]) {
  const runtime = ManagedRuntime.make(fakeDb(client));
  runtimes.push(runtime);
  const authenticated = new Elysia({ prefix: "/api/v1" }).derive(() => ({
    userId: "user-1",
    requestId: "req-1",
  }));
  registerTestErrorHandlers(authenticated);
  return registerUserRoutes(authenticated as never, runtime) as unknown as {
    handle(request: Request): Promise<Response>;
  };
}

const get = (path: string) => new Request(`http://localhost/api/v1${path}`);

describe("registerUserRoutes", () => {
  test("GET /me/preferences answers the defaults for a user with no row", async () => {
    const app = appWith({
      query: { userPreferences: { findFirst: () => Promise.resolve(undefined) } },
    });

    const response = await app.handle(get("/me/preferences"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ defaultMode: "smart", fontSizePx: 17 });
  });

  test("PATCH /me/preferences applies the patch and answers the stored preferences", async () => {
    const stored = {
      userId: "user-1",
      readerMode: "smart",
      readerFontSizePx: 17,
      readerContentWidth: "wide",
      readerOpenLinksInNewTab: true,
      readerShowLinkPreviews: true,
      readerShowImages: true,
      readerRememberPosition: true,
      inboxDefaultView: "my-feed",
      inboxDensity: "compact",
      articleOpenBehavior: "split",
      inboxMarkReadBehavior: "on-open",
      inboxTimestampDisplay: "relative",
      inboxTimestampHourCycle: "12h",
      inboxFontSizePx: 16,
      inboxShowFavicons: true,
    };
    const app = appWith({
      insert: () => ({
        values: () => ({ onConflictDoNothing: () => ({ returning: () => Promise.resolve([]) }) }),
      }),
      update: () => ({
        set: () => ({ where: () => ({ returning: () => Promise.resolve([stored]) }) }),
      }),
    });

    const response = await app.handle(
      new Request("http://localhost/api/v1/me/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inboxDensity: "compact" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ inboxDensity: "compact", defaultMode: "smart" });
  });

  test("GET /users/profile renders USER_NOT_FOUND (404) when the user is gone", async () => {
    const app = appWith({ query: { users: { findFirst: () => Promise.resolve(undefined) } } });

    const response = await app.handle(get("/users/profile"));

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { message: "User not found", code: "USER_NOT_FOUND" },
    });
  });

  test("GET /users/memberships wraps the rows in { items }", async () => {
    const row = {
      membershipId: "m1",
      organizationId: "o1",
      organizationName: "Acme",
      plan: "team",
      role: "admin",
    };
    const app = appWith({
      select: () => ({
        from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([row]) }) }),
      }),
    });

    const response = await app.handle(get("/users/memberships"));

    expect(await response.json()).toEqual({ items: [row] });
  });

  test("POST /users/profile/email rejects an invalid address with USER_EMAIL_INVALID", async () => {
    const app = appWith({});

    const response = await app.handle(
      new Request("http://localhost/api/v1/users/profile/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "nope" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "USER_EMAIL_INVALID" } });
  });
});
