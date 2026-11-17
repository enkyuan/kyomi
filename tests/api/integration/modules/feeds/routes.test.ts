import { afterEach, describe, expect, test } from "bun:test";
import { Effect, Layer, ManagedRuntime } from "effect";
import { FeedSearch, type FeedSearchShape } from "@adapters/search/service";
import { registerFeedRoutes } from "@modules/feeds/routes";
import { FeedBackground } from "@modules/feeds/service";
import { Elysia, registerTestErrorHandlers } from "@api-tests/support/elysia";
import {
  fakeDb,
  fakeHttpClient,
  fakeQueue,
  recordingLogger,
  testConfig,
} from "@api-tests/support/layers";

const FEED_ID = "550e8400-e29b-41d4-a716-446655440000";

const runtimes: Array<{ dispose: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
});

const idleSearch: FeedSearchShape = {
  isConfigured: () => false,
  upsert: () => Effect.void,
  remove: () => Effect.void,
  search: () => Effect.succeed([]),
};

/** `select().from().where().limit()` resolving to `rows`. */
const selecting = (rows: unknown[]) => ({
  select: () => ({ from: () => ({ where: () => ({ limit: async () => rows }) }) }),
});

/**
 * The feed routes on a real Elysia app. `userId` and `requestId` are what `resolveSessionContext`
 * puts on the context; every service behind the routes is a test Layer.
 */
function appWith(db: Parameters<typeof fakeDb>[0], published: unknown[][] = []) {
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(
      fakeDb(db),
      fakeQueue({
        xadd: async (...args: unknown[]) => {
          published.push(args);
          return "1-0";
        },
      }),
      recordingLogger().layer,
      testConfig(),
      Layer.succeed(FeedSearch, FeedSearch.of(idleSearch)),
      fakeHttpClient(() => new Response(null, { status: 404 })),
      FeedBackground.layer,
    ),
  );
  runtimes.push(runtime);
  const app = new Elysia().derive(() => ({ userId: "user-1", requestId: "req-1" }));
  registerTestErrorHandlers(app);
  registerFeedRoutes(app as never, runtime);
  return app;
}

type App = ReturnType<typeof appWith>;

const call = (app: App, method: string, path: string, body?: unknown) =>
  app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: { "content-type": "application/json", "x-request-id": "req-1" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );

describe("feed routes", () => {
  test("registers the subscription, refresh, read and admin endpoints", () => {
    const routes = appWith({}).routes.map((route) => `${route.method} ${route.path}`);

    expect(routes.sort()).toEqual(
      [
        "DELETE /feeds",
        "DELETE /feeds/:feedId",
        "DELETE /feeds/:feedId/admin",
        "GET /feeds",
        "GET /feeds/:feedId",
        "GET /feeds/refresh-status",
        "PATCH /feeds/folder",
        "POST /feeds",
        "POST /feeds/:feedId/refresh",
        "POST /feeds/:feedId/subscribe",
        "POST /feeds/refresh",
        "PUT /feeds/:feedId",
        "PUT /feeds/:feedId/admin",
        "PUT /feeds/:feedId/read-status",
      ].sort(),
    );
  });

  test("GET /feeds lists the subscriptions in an items envelope", async () => {
    const app = appWith({
      select: () => ({
        from: () => ({
          innerJoin: () => ({ leftJoin: () => ({ where: async () => [] }) }),
        }),
      }),
    });

    const response = await call(app, "GET", "/feeds");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
  });

  test("a missing subscription renders the standard 404 envelope with the request id", async () => {
    const app = appWith({
      delete: () => ({ where: () => ({ returning: async () => [] }) }),
    });

    const response = await call(app, "DELETE", `/feeds/${FEED_ID}`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        message: "Subscription not found",
        code: "SUBSCRIPTION_NOT_FOUND",
        requestId: "req-1",
      },
    });
  });

  test("marking a feed read without a subscription is 403 NOT_SUBSCRIBED", async () => {
    const response = await call(appWith(selecting([])), "PUT", `/feeds/${FEED_ID}/read-status`);

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "NOT_SUBSCRIBED" } });
  });

  test("subscribing to an unknown feed id is 404 FEED_NOT_FOUND", async () => {
    const tx = selecting([]);
    const app = appWith({ transaction: async (run: (tx: unknown) => unknown) => run(tx) });

    const response = await call(app, "POST", `/feeds/${FEED_ID}/subscribe`);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "FEED_NOT_FOUND" } });
  });

  test("a feed id that is not a UUID is a validation error before any work", async () => {
    const response = await call(appWith({}), "DELETE", "/feeds/not-a-uuid");

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  test("refreshing a subscribed feed answers 202 and publishes the job", async () => {
    const published: unknown[][] = [];
    const app = appWith(
      {
        ...selecting([{ id: "sub-1" }]),
        update: () => ({
          set: () => ({ where: () => ({ returning: async () => [{ generation: 3 }] }) }),
        }),
      },
      published,
    );

    const response = await call(app, "POST", `/feeds/${FEED_ID}/refresh`);

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: true, jobId: "1-0", type: "feed.refresh" });
    expect(published).toHaveLength(1);
  });

  test("refreshing a feed the user is not subscribed to is 403 and publishes nothing", async () => {
    const published: unknown[][] = [];

    const response = await call(
      appWith(selecting([]), published),
      "POST",
      `/feeds/${FEED_ID}/refresh`,
    );

    expect(response.status).toBe(403);
    expect(published).toHaveLength(0);
  });

  test("the admin endpoints are closed when no admin is configured", async () => {
    const response = await call(appWith({}), "DELETE", `/feeds/${FEED_ID}/admin`);

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "FEED_ADMIN_DISABLED" } });
  });
});
