import { afterEach, describe, expect, test } from "bun:test";
import { Layer, ManagedRuntime } from "effect";
import { FeedSearch } from "@adapters/search/service";
import { registerDiscoverRoutes } from "@modules/discover/routes";
import { Elysia, registerTestErrorHandlers } from "@api-tests/support/elysia";
import { fakeDb, recordingLogger, testConfig } from "@api-tests/support/layers";
import { scriptedHttpClient } from "@api-tests/support/http";
import { selectsReturning } from "./helpers";

const runtimes: Array<{ dispose: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
});

const feedRow = {
  id: "feed_1",
  url: "https://example.com/feed.xml",
  title: "Example Feed",
  description: "Latest updates",
  link: "https://example.com",
  faviconUrl: null,
  isSubscribed: false,
  score: 3,
};

function appWith(options: {
  rows?: unknown[][];
  respond?: Parameters<typeof scriptedHttpClient>[0];
}) {
  const http = scriptedHttpClient(options.respond ?? (() => new Error("no network in this test")));
  const logs = recordingLogger();
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(
      fakeDb({ select: selectsReturning(...(options.rows ?? [])).select }),
      logs.layer,
      http,
      FeedSearch.layer.pipe(Layer.provide(Layer.mergeAll(http, testConfig()))),
    ),
  );
  runtimes.push(runtime);

  const rateLimited: Array<{ subject: string; bucket: string }> = [];
  const app = new Elysia().derive(() => ({
    userId: "user-1",
    requestId: "req-1",
    enforceRateLimit: async (subject: string, rule: { name: string }) => {
      rateLimited.push({ subject, bucket: rule.name });
    },
  }));
  registerTestErrorHandlers(app);
  registerDiscoverRoutes(app as never, runtime);
  return { app, logs, rateLimited };
}

const get = (app: { handle: (request: Request) => Promise<Response> }, path: string) =>
  app.handle(new Request(`http://localhost${path}`, { headers: { "x-request-id": "req-1" } }));

describe("discover routes", () => {
  test("registers search and preview", () => {
    const { app } = appWith({});

    expect(app.routes.map((route) => `${route.method} ${route.path}`)).toEqual([
      "GET /discover/search",
      "GET /discover/preview",
    ]);
  });

  test("search rate-limits the user, returns the feeds and logs the outcome", async () => {
    const { app, logs, rateLimited } = appWith({ rows: [[feedRow]] });

    const response = await get(app, "/discover/search?q=example&limit=5");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        id: "feed_1",
        url: "https://example.com/feed.xml",
        title: "Example Feed",
        description: "Latest updates",
        link: "https://example.com",
        faviconUrl: null,
        isSubscribed: false,
      },
    ]);
    expect(rateLimited).toEqual([{ subject: "user-1", bucket: "discover.search" }]);
    expect(logs.entries).toContainEqual({
      level: "info",
      event: "discover.search.ok",
      context: { requestId: "req-1", userId: "user-1", query: "example", resultCount: 1 },
    });
  });

  test("search rejects an empty query at the edge", async () => {
    const response = await get(appWith({}).app, "/discover/search?q=");

    expect(response.status).toBe(422);
  });

  test("preview answers from a known feed without any network call", async () => {
    const { app, rateLimited } = appWith({ rows: [[{ ...feedRow, isSubscribed: true }]] });

    const response = await get(
      app,
      `/discover/preview?url=${encodeURIComponent("https://example.com/feed.xml")}`,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "feed_1", isSubscribed: true });
    expect(rateLimited).toEqual([{ subject: "user-1", bucket: "discover.preview" }]);
  });

  test("preview renders a feed that cannot be fetched with its wire code and details", async () => {
    const { app } = appWith({
      rows: [[]],
      respond: () => new Response("nope", { status: 500 }),
    });

    const response = await get(
      app,
      `/discover/preview?url=${encodeURIComponent("https://93.184.216.34/feed.xml")}`,
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: {
        message: "Could not fetch feed",
        code: "FEED_FETCH_FAILED",
        requestId: "req-1",
        details: { fetchCode: "HTTP_ERROR", fetchError: "HTTP 500", fetchStatus: 500 },
      },
    });
  });

  test("preview renders a blocked URL as a 400 FEED_URL_FORBIDDEN", async () => {
    const { app } = appWith({
      rows: [[]],
      respond: () =>
        new Response(null, { status: 302, headers: { location: "http://127.0.0.1/x.xml" } }),
    });

    const response = await get(
      app,
      `/discover/preview?url=${encodeURIComponent("https://93.184.216.34/feed.xml")}`,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "FEED_URL_FORBIDDEN" } });
  });

  test("preview renders a malformed URL as a 400 INVALID_FEED_URL", async () => {
    const response = await get(appWith({ rows: [[]] }).app, "/discover/preview?url=not-a-url");

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_FEED_URL" } });
  });
});
