import { afterEach, describe, expect, mock, test } from "bun:test";
import { ARTICLE_HTML_SANITIZER_VERSION } from "@kyomi/reader/sanitization";
import { runArticleExtractionForUser } from "@modules/articles/reader/extraction/workflow";
import { cacheRow, createExtractionDb, PERFORMANCE_DEV_LINEAR_FIXTURE } from "./workflow-harness";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("article extraction raw source", () => {
  test("worker cache miss stores the raw Readability body beside the compiled HTML", async () => {
    const html = await Bun.file(PERFORMANCE_DEV_LINEAR_FIXTURE).text();
    const db = createExtractionDb();
    globalThis.fetch = mock(
      async () => new Response(html, { status: 200, headers: { "content-type": "text/html" } }),
    ) as unknown as typeof fetch;

    await runArticleExtractionForUser(db as never, "user-1", "item-1");
    const item = db.item as Record<string, unknown>;

    const raw = String(db.cache?.rawHtml);
    expect(raw).toContain("Linear feels immediate");
    expect(item.extractedContentRaw).toBe(raw);
    expect(item.extractedContentSanitizerVersion).toBe(ARTICLE_HTML_SANITIZER_VERSION);
    expect(db.cache?.sanitizerVersion).toBe(ARTICLE_HTML_SANITIZER_VERSION);
    expect(item.extractedContentHtml).not.toBe(raw);
  });

  test("stale ready cache with raw source is recompiled instead of re-sanitized", async () => {
    const rawHtml = `<div><p data-kyomi-url="javascript:alert(1)">Body text for the article.</p>
      <img src="data:image/gif;base64,R0" data-src="images/flow.png" alt="Flow">
      <iframe src="https://player.vimeo.com/video/76979871" title="Demo"></iframe></div>`;
    const db = createExtractionDb({
      cache: cacheRow({
        contentHtml: "<p>Old v1 body.</p>",
        contentText: "Old v1 body.",
        sanitizerVersion: "article-html-v1",
        rawHtml,
        finalUrl: "https://93.184.216.34/posts/flow/",
      }),
    });
    const fetchMock = mock(async () => new Response("should not fetch"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await runArticleExtractionForUser(db as never, "user-1", "item-1");
    const item = db.item as Record<string, unknown>;

    const html = String(item.extractedContentHtml);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(html).toContain('src="https://93.184.216.34/posts/flow/images/flow.png"');
    expect(html).toContain('data-kyomi-embed="vimeo"');
    expect(html).not.toContain("Old v1 body");
    expect(html).not.toContain("javascript:");
    expect(item.extractedContentRaw).toBe(rawHtml);
    expect(item.extractedContentSanitizerVersion).toBe(ARTICLE_HTML_SANITIZER_VERSION);
    expect(String(item.extractedContentText)).toContain("Body text for the article.");
  });

  test("stale ready cache without raw source keeps its re-sanitized HTML", async () => {
    const db = createExtractionDb({
      cache: cacheRow({
        contentHtml: '<p onclick="x()">Legacy cached body.</p>',
        contentText: "Legacy cached body.",
        sanitizerVersion: null,
        rawHtml: null,
      }),
    });
    globalThis.fetch = mock(
      async () => new Response("should not fetch"),
    ) as unknown as typeof fetch;

    await runArticleExtractionForUser(db as never, "user-1", "item-1");
    const item = db.item as Record<string, unknown>;

    expect(item.extractedContentHtml).toBe("<p>Legacy cached body.</p>");
    expect(item.extractedContentRaw).toBeNull();
  });
});
