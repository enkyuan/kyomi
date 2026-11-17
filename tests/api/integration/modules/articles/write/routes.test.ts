import { afterEach, describe, expect, mock, test } from "bun:test";
import { Layer, ManagedRuntime } from "effect";
import { registerArticleWriteRoutes } from "@modules/articles/write/routes";
import { Elysia, registerTestErrorHandlers } from "@api-tests/support/elysia";
import { fakeDb, fakeQueue, silentLogger } from "@api-tests/support/layers";

const runtimes: Array<{ dispose: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
});

const ARTICLE_ID = "00000000-0000-4000-8000-0000000000c1";

const CLIP_ROW = {
  id: ARTICLE_ID,
  userId: "user-1",
  url: "https://example.com/article",
  title: "example.com",
  content: null,
  contentHtml: null,
  contentText: null,
  contentMarkdown: null,
  contentStatus: "pending",
  contentSource: "link_only",
  extractionErrorCode: null,
  extractionErrorMessage: null,
  extractedContentHtml: null,
  extractedContentText: null,
  extractedContentStatus: "pending",
  extractedContentError: null,
  extractedContentUpdatedAt: null,
  note: null,
  isRead: false,
  isSaved: true,
  createdAt: new Date("2026-04-08T10:00:00.000Z"),
  updatedAt: new Date("2026-04-08T10:00:00.000Z"),
};

/** A select chain that resolves to `rows` however it is filtered. */
const selecting = (rows: unknown[]) => () => {
  const chain: Record<string, unknown> = {};
  for (const step of ["from", "where", "innerJoin", "leftJoin"]) {
    chain[step] = () => chain;
  }
  chain.limit = () => Promise.resolve(rows);
  return chain;
};

function appWith(db: Parameters<typeof fakeDb>[0], redis: Parameters<typeof fakeQueue>[0] = {}) {
  const runtime = ManagedRuntime.make(Layer.mergeAll(fakeDb(db), fakeQueue(redis), silentLogger));
  runtimes.push(runtime);
  const app = new Elysia().derive(() => ({ userId: "user-1", requestId: "req-1" }));
  registerTestErrorHandlers(app);
  registerArticleWriteRoutes(app as never, runtime);
  return app;
}

function send(app: ReturnType<typeof appWith>, method: string, path: string, body?: unknown) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: { "content-type": "application/json", "x-request-id": "req-1" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

describe("article write routes", () => {
  test("registers the four write routes", () => {
    const app = appWith({});

    expect(app.routes.map((route) => `${route.method} ${route.path}`)).toEqual([
      "POST /articles",
      "POST /articles/:articleId/view",
      "POST /articles/:articleId/reports/broken",
      "PUT /articles/:articleId",
    ]);
  });

  test("POST /articles saves the clip, queues extraction and answers 201 with the detail", async () => {
    const xadd = mock(async () => "1-0");
    const returning = mock(() => Promise.resolve([CLIP_ROW]));
    const app = appWith({ insert: () => ({ values: () => ({ returning }) }) }, { xadd });

    const response = await send(app, "POST", "/articles", { url: "https://example.com/article" });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      id: ARTICLE_ID,
      articleType: "clip",
      contentStatus: "pending",
    });
    expect(xadd).toHaveBeenCalledTimes(1);
  });

  test("POST /articles with an unusable url renders the public error envelope", async () => {
    const app = appWith({});

    const response = await send(app, "POST", "/articles", { url: "ftp://example.com/a" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { message: "Invalid URL", code: "INVALID_CLIP_URL", requestId: "req-1" },
    });
  });

  test("POST /articles/:articleId/view records a view of the user's clip", async () => {
    const insert = mock(() => ({ values: () => Promise.resolve() }));
    const app = appWith({
      update: () => ({
        set: () => ({ where: () => ({ returning: () => Promise.resolve([{ id: ARTICLE_ID }]) }) }),
      }),
      insert,
    });

    const response = await send(app, "POST", `/articles/${ARTICLE_ID}/view`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: "Article view recorded" });
    expect(insert).toHaveBeenCalledTimes(1);
  });

  test("POST /articles/:articleId/view of an unknown article is a 404", async () => {
    const app = appWith({
      update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }) }),
      select: selecting([]),
    });

    const response = await send(app, "POST", "/articles/00000000-0000-4000-8000-00000000dead/view");

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "ARTICLE_NOT_FOUND" } });
  });

  test("POST /articles/:articleId/reports/broken files a report for the user's clip", async () => {
    const values = mock(() => Promise.resolve());
    const app = appWith({
      select: selecting([{ id: ARTICLE_ID, title: "Clip", url: "https://example.com/c" }]),
      insert: () => ({ values }),
    });

    const response = await send(app, "POST", `/articles/${ARTICLE_ID}/reports/broken`, {
      reason: "missing_content",
      details: "  blank page  ",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: "Broken article report submitted" });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        articleType: "clip",
        clipId: ARTICLE_ID,
        reason: "missing_content",
        details: "blank page",
      }),
    );
  });

  test("PUT /articles/:articleId with no updatable field is a 400 EMPTY_UPDATE", async () => {
    const app = appWith({ select: selecting([{ id: ARTICLE_ID }]) });

    const response = await send(app, "PUT", `/articles/${ARTICLE_ID}`, {});

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "EMPTY_UPDATE" } });
  });

  test("PUT /articles/:articleId refuses to hide a clip", async () => {
    const app = appWith({ select: selecting([{ id: ARTICLE_ID }]) });

    const response = await send(app, "PUT", `/articles/${ARTICLE_ID}`, { isHidden: true });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "CLIP_HIDE_UNSUPPORTED" } });
  });

  test("a database failure renders an opaque 500 without leaking the cause", async () => {
    const app = appWith({
      select: () => {
        throw new Error("password authentication failed for user postgres");
      },
    });

    const response = await send(app, "PUT", `/articles/${ARTICLE_ID}`, { isRead: true });

    expect(response.status).toBe(500);
    const json = (await response.json()) as { error: { message: string; code: string } };
    expect(json.error).toMatchObject({ message: "Internal error", code: "INTERNAL_ERROR" });
    expect(JSON.stringify(json)).not.toContain("password");
  });
});
