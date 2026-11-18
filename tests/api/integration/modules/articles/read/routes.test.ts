import { afterEach, describe, expect, test } from "bun:test";
import { Layer, ManagedRuntime } from "effect";
import type { Db } from "@adapters/db/service";
import { registerArticleReadRoutes } from "@modules/articles/read/routes";
import { Elysia, registerTestErrorHandlers } from "@api-tests/support/elysia";
import { fakeDb, recordingLogger, testConfig } from "@api-tests/support/layers";
import { rawDetailRow, selectBy, type SelectFields } from "./fakes";

const runtimes: Array<{ dispose: () => Promise<void> }> = [];

/** The `/api/v1` shape: a derived authenticated user and request id, then the read routes. */
function appWith(layer: Layer.Layer<Db>) {
  const runtime = ManagedRuntime.make(Layer.mergeAll(layer, testConfig(), recordingLogger().layer));
  runtimes.push(runtime);
  const app = new Elysia().derive(() => ({ userId: "user_1", requestId: "req-1" }));
  // As in `createApp`: error handlers first, so every route registered after them is covered.
  registerTestErrorHandlers(app);
  registerArticleReadRoutes(app as never, runtime as never);
  return app;
}

const get = (app: { handle: (request: Request) => Promise<Response> }, path: string) =>
  app.handle(new Request(`http://localhost${path}`, { headers: { "x-request-id": "req-1" } }));

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
});

const ARTICLE_ID = "6f1b5c1e-8c1b-4a63-9a4e-2d5f7a0b9c11";

const emptyPage = { items: [], next_cursor: null, has_more: false, total_count: null };

describe("article read routes", () => {
  test("a blank url is a 400 envelope with the stable code and request id", async () => {
    const app = appWith(selectBy(() => []).layer);

    const response = await get(app, "/articles/check-saved?url=%20%20");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        message: "url is required",
        code: "ARTICLE_URL_REQUIRED",
        requestId: "req-1",
      },
    });
  });

  test("check-saved reports a saved clip", async () => {
    const db = selectBy(() => [{ id: "clip_1", title: "Saved", url: "https://example.com/a" }]);

    const response = await get(
      appWith(db.layer),
      "/articles/check-saved?url=https://example.com/a",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      is_saved: true,
      article: { id: "clip_1", title: "Saved", url: "https://example.com/a", articleType: "clip" },
    });
  });

  test("a malformed merged-view cursor is a 400 with its code", async () => {
    const response = await get(
      appWith(selectBy(() => []).layer),
      "/articles/views/today?cursor=bad",
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "MERGED_VIEW_CURSOR_INVALID", message: "Invalid merged view cursor." },
    });
  });

  test("an unknown article is a 404 ARTICLE_NOT_FOUND", async () => {
    const response = await get(appWith(selectBy(() => []).layer), `/articles/${ARTICLE_ID}`);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { code: "ARTICLE_NOT_FOUND", message: "Article not found", requestId: "req-1" },
    });
  });

  test("article detail answers 200 and tells caches it varies by document version", async () => {
    const db = selectBy((fields: SelectFields) =>
      fields && "feedTitle" in fields ? [rawDetailRow({ id: ARTICLE_ID })] : [],
    );

    const response = await get(appWith(db.layer), `/articles/${ARTICLE_ID}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("vary")).toContain("X-Kyomi-Document-Version");
    expect(await response.json()).toMatchObject({ id: ARTICLE_ID, articleType: "feed" });
  });

  test("counts: feed and clip totals, plus today when both bounds are given", async () => {
    const app = appWith(selectBy(() => [{ c: 2 }]).layer);

    const plain = await get(app, "/articles/counts");
    expect(await plain.json()).toEqual({ all: 4, unread: 2, saved: 4 });

    const withToday = await get(
      app,
      "/articles/counts?published_after=2026-07-01T00:00:00.000Z&published_before=2026-07-02T00:00:00.000Z",
    );
    expect(await withToday.json()).toEqual({ all: 4, unread: 2, saved: 4, today: 2 });
  });

  test("the global all view counts feed items only", async () => {
    const response = await get(
      appWith(selectBy(() => [{ c: 5 }]).layer),
      "/articles/counts?view=all",
    );

    expect(await response.json()).toEqual({ all: 5, unread: 5, saved: 5 });
  });

  test("unread-counts splits and trims feed_ids and defaults missing feeds to zero", async () => {
    const db = selectBy(() => [{ feedId: "a", count: 3 }]);

    const response = await get(appWith(db.layer), "/articles/unread-counts?feed_ids=a,%20b,,");

    expect(await response.json()).toEqual({ a: 3, b: 0 });
  });

  test("clips list answers on the canonical path, its deprecated alias and source=clips", async () => {
    const app = appWith(selectBy(() => []).layer);

    for (const path of ["/articles/clips", "/articles/write/clips", "/articles?source=clips"]) {
      const response = await get(app, path);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(emptyPage);
    }
  });

  test("the legacy saved alias serves the same page as read-later", async () => {
    const app = appWith(selectBy(() => []).layer);

    const [alias, canonical] = await Promise.all([
      get(app, "/articles/saved"),
      get(app, "/articles/views/read-later"),
    ]);

    expect(await alias.json()).toEqual(await canonical.json());
  });

  test("a database failure is an opaque 500, never the driver message", async () => {
    const app = appWith(
      fakeDb({
        select: () => {
          throw new Error("password authentication failed for user kyomi");
        },
      }),
    );

    const response = await get(app, "/articles/counts");
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toMatchObject({ code: "INTERNAL_ERROR", message: "Internal error" });
    expect(JSON.stringify(body)).not.toContain("password");
  });
});
