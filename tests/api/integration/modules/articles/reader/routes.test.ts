import { afterEach, describe, expect, test } from "bun:test";
import { Layer, ManagedRuntime } from "effect";
import { registerArticleEnrichmentRoutes } from "@modules/articles/reader/routes";
import { fakeQueue, recordingLogger, testConfig } from "@api-tests/support/layers";
import { selectResults } from "../read/fakes";
import { feedDetailRow } from "./fixtures";
import { Elysia, registerTestErrorHandlers } from "@api-tests/support/elysia";

type App = { handle(request: Request): Promise<Response> };

const ID = "0b4e1c9a-0000-4000-8000-000000000001";
const MISSING_ID = "0b4e1c9a-0000-4000-8000-000000000002";

const runtimes: Array<{ dispose: () => Promise<void> }> = [];

/** The enrichment routes behind a stub session (`user-1`), over a fake article table. */
function appWith(feedRows: unknown[], config: Record<string, string> = {}) {
  const logs = recordingLogger();
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(selectResults(feedRows, []).layer, fakeQueue(), testConfig(config), logs.layer),
  );
  runtimes.push(runtime);
  const session = new Elysia().derive(() => ({ userId: "user-1", requestId: "req-1" }));
  // Elysia hooks only reach routes registered after them.
  registerTestErrorHandlers(session);
  const app = registerArticleEnrichmentRoutes(session as never, runtime as never);
  return { app: app as unknown as App, logs };
}

function post(app: App, path: string, body: unknown) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": "req-1" },
      body: JSON.stringify(body),
    }),
  );
}

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
});

const ARTICLE = feedDetailRow({
  id: ID,
  contentHtml: "<p>First point. Second point. Third point. Fourth point.</p>",
  contentText: "First point. Second point. Third point. Fourth point.",
});

describe("article enrichment routes", () => {
  test("summarize answers with the first sentences of the article body and logs it", async () => {
    const { app, logs } = appWith([ARTICLE]);

    const response = await post(app, `/articles/${ID}/summarize`, {});

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ summary: "First point. Second point. Third point." });
    expect(logs.entries).toEqual([
      {
        level: "info",
        event: "articles.summarize.succeeded",
        context: { requestId: "req-1", userId: "user-1", articleId: ID },
      },
    ]);
  });

  test("summarize prefers request content and tags the language", async () => {
    const { app } = appWith([ARTICLE]);

    const response = await post(app, `/articles/${ID}/summarize`, {
      content: "Own text. More text.",
      language_key: "fr",
    });

    expect(await response.json()).toEqual({ summary: "[fr] Own text. More text." });
  });

  test("an unknown article is the standard 404 envelope", async () => {
    const { app } = appWith([]);

    const response = await post(app, `/articles/${MISSING_ID}/summarize`, {});

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { message: "Article not found", code: "ARTICLE_NOT_FOUND", requestId: "req-1" },
    });
  });

  test("an article with nothing to process is a 400 with its stable code", async () => {
    const { app } = appWith([feedDetailRow({ id: ID })]);

    const response = await post(app, `/articles/${ID}/summarize`, {});

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { message: "No content available to process", code: "ARTICLE_CONTENT_MISSING" },
    });
  });

  test("content over the field budget is a 413 that names the field", async () => {
    const { app } = appWith([ARTICLE]);

    const response = await post(app, `/articles/${ID}/translate`, {
      content: "é".repeat(600_000),
      target_language: "de",
    });

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      error: {
        message: "Content field exceeds maximum size",
        code: "ARTICLE_CONTENT_TOO_LARGE",
        details: { field: "content", bytes: 1_200_000, maxBytes: 1024 * 1024 },
      },
    });
  });

  test("translate answers with the marked content and echoes the target", async () => {
    const { app, logs } = appWith([ARTICLE]);

    const response = await post(app, `/articles/${ID}/translate`, {
      content: "Hello",
      target_language: "de",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      translated_content: "[translated:de] Hello",
      target_language: "de",
    });
    expect(logs.entries[0]).toMatchObject({
      event: "articles.translate.succeeded",
      context: { targetLanguage: "de" },
    });
  });

  test("a blank target language is a 400, an empty one fails validation", async () => {
    const { app } = appWith([ARTICLE]);

    const blank = await post(app, `/articles/${ID}/translate`, { target_language: "   " });
    const empty = await post(app, `/articles/${ID}/translate`, { target_language: "" });

    expect(blank.status).toBe(400);
    expect(await blank.json()).toMatchObject({ error: { code: "TARGET_LANGUAGE_REQUIRED" } });
    expect(empty.status).toBe(422);
  });

  test("extract-full-text serves an already extracted article without queueing", async () => {
    const extracted = feedDetailRow({
      id: ID,
      extractedContentHtml: "<p>Extracted body text.</p>",
      extractedContentText: "Extracted body text.",
      extractedContentStatus: "ready",
      extractedContentUpdatedAt: new Date("2026-01-02T00:00:00Z"),
    });
    const { app, logs } = appWith([extracted]);

    const response = await post(app, `/articles/${ID}/extract-full-text`, {});

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: boolean;
      status: string;
      article: { id: string };
    };
    expect(body).toMatchObject({ ok: true, status: "ready", article: { id: ID } });
    expect(logs.entries).toEqual([
      {
        level: "info",
        event: "articles.extract_full_text.accepted",
        context: { requestId: "req-1", userId: "user-1", articleId: ID, status: "ready" },
      },
    ]);
  });
});
