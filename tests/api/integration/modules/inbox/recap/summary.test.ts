import { afterEach, describe, expect, test } from "bun:test";
import { Layer, ManagedRuntime } from "effect";
import { createApp } from "@app/http/app";
import { createAppRuntime } from "@app/runtime";
import { registerInboxRoutes } from "@modules/inbox/routes";
import { normalizeRecapLimit } from "@modules/inbox/recap/summary";
import { Elysia, registerTestErrorHandlers } from "@api-tests/support/elysia";
import { fakeDb, silentLogger } from "@api-tests/support/layers";

const runtimes: Array<{ dispose: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
});

const date = (iso: string) => new Date(iso);

/** A select chain that resolves to `rows` however it is filtered, joined or ordered. */
function chainOf(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  for (const step of ["from", "where", "innerJoin", "leftJoin", "orderBy", "limit", "groupBy"]) {
    chain[step] = () => chain;
  }
  chain.then = (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(rows).then(resolve, reject);
  return chain;
}

/** The recap runs four selects; each is told apart by a column only it selects. */
function recapDb(limits: number[] = []) {
  return fakeDb({
    select: (columns: Record<string, unknown>) => {
      const chain = chainOf(
        "feedCount" in columns
          ? [
              {
                id: "f1",
                name: "News",
                createdAt: date("2026-01-01T00:00:00Z"),
                isPinned: true,
                pinnedAt: date("2026-01-02T00:00:00Z"),
                feedCount: 3,
              },
            ]
          : "viewedItemCount" in columns
            ? [
                {
                  feedId: "feed-1",
                  url: "https://example.com/feed.xml",
                  title: "Example &amp; Co",
                  siteUrl: null,
                  faviconUrl: null,
                  viewedItemCount: 7,
                  lastViewedAt: date("2026-02-01T00:00:00Z"),
                  subscriptionId: "sub-1",
                  customTitle: null,
                  folderId: "f1",
                  folderName: "News",
                },
              ]
            : "note" in columns
              ? [
                  {
                    id: "clip-1",
                    title: "A clip",
                    url: "https://example.com/clip",
                    note: null,
                    createdAt: date("2026-01-03T00:00:00Z"),
                    isRead: false,
                    isSaved: true,
                    lastViewedAt: null,
                    savedAt: date("2026-03-01T00:00:00Z"),
                  },
                ]
              : [
                  {
                    id: "item-1",
                    title: "An item",
                    link: "https://example.com/item",
                    summary: null,
                    publishedAt: date("2026-01-04T00:00:00Z"),
                    feedId: "feed-1",
                    feedUrl: "https://example.com/feed.xml",
                    feedSiteUrl: null,
                    feedTitle: "Example",
                    feedFaviconUrl: null,
                    isRead: true,
                    isSaved: true,
                    lastViewedAt: null,
                    savedAt: date("2026-02-01T00:00:00Z"),
                  },
                ],
      );
      const limit = chain.limit as () => unknown;
      chain.limit = (value: number) => {
        limits.push(value);
        return limit();
      };
      return chain;
    },
  });
}

function recapApp(db = recapDb()) {
  const runtime = ManagedRuntime.make(Layer.mergeAll(db, silentLogger));
  runtimes.push(runtime);
  const app = new Elysia().derive(() => ({ userId: "user-1", requestId: "req-1" }));
  registerTestErrorHandlers(app);
  registerInboxRoutes(app as never, runtime);
  return app;
}

describe("inbox recap summary", () => {
  test("normalizes rail limits", () => {
    expect(normalizeRecapLimit(undefined)).toBe(5);
    expect(normalizeRecapLimit("")).toBe(5);
    expect(normalizeRecapLimit("0")).toBe(1);
    expect(normalizeRecapLimit("50")).toBe(20);
    expect(normalizeRecapLimit("8")).toBe(8);
  });

  test("serves folders, top viewed feeds and the oldest saved items, oldest first", async () => {
    const response = await recapApp().handle(
      new Request("http://localhost/inbox/recap?limit=5", { headers: { "x-request-id": "req-1" } }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      folders: unknown[];
      topViewedFeeds: unknown[];
      oldestSavedItems: Array<{ id: string; articleType: string; savedAt: string }>;
    };
    expect(body.folders).toEqual([
      {
        id: "f1",
        name: "News",
        createdAt: "2026-01-01T00:00:00.000Z",
        isPinned: true,
        pinnedAt: "2026-01-02T00:00:00.000Z",
        feedCount: 3,
      },
    ]);
    expect(body.topViewedFeeds).toEqual([
      {
        feedId: "feed-1",
        title: "Example & Co",
        url: "https://example.com/feed.xml",
        siteUrl: null,
        faviconUrl: null,
        viewedItemCount: 7,
        lastViewedAt: "2026-02-01T00:00:00.000Z",
        isSubscribed: true,
        folderId: "f1",
        folderName: "News",
      },
    ]);
    expect(body.oldestSavedItems.map((item) => [item.id, item.articleType])).toEqual([
      ["item-1", "feed"],
      ["clip-1", "clip"],
    ]);
  });

  test("clamps the requested limit before querying", async () => {
    const limits: number[] = [];
    await recapApp(recapDb(limits)).handle(
      new Request("http://localhost/inbox/recap?limit=500", {
        headers: { "x-request-id": "req-1" },
      }),
    );

    expect(limits.length).toBeGreaterThan(0);
    expect(new Set(limits)).toEqual(new Set([20]));
  });

  test("a database failure renders the standard error envelope without leaking the cause", async () => {
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(
        fakeDb({
          select: () => {
            throw new Error("connection refused 10.0.0.5");
          },
        }),
        silentLogger,
      ),
    );
    runtimes.push(runtime);
    const app = new Elysia().derive(() => ({ userId: "user-1", requestId: "req-1" }));
    registerTestErrorHandlers(app);
    registerInboxRoutes(app as never, runtime);

    const response = await app.handle(
      new Request("http://localhost/inbox/recap", { headers: { "x-request-id": "req-1" } }),
    );

    expect(response.status).toBe(500);
    const body = await response.text();
    expect(JSON.parse(body)).toMatchObject({
      error: { code: "INTERNAL_ERROR", requestId: "req-1" },
    });
    expect(body).not.toContain("10.0.0.5");
  });

  test("registers the recap endpoint under api v1", async () => {
    // The real runtime (built lazily, connects on first use); disposed so no pool or client leaks.
    const runtime = createAppRuntime();
    runtimes.push(runtime);
    const app = createApp({ runtime });
    const response = await app.handle(new Request("http://localhost/api/v1/inbox/recap?limit=5"));

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(401);
  });
});
