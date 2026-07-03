import { describe, expect, test } from "bun:test";
import {
  buildArticleReaderDto,
  type ArticleReaderContentDto,
} from "@modules/articles/reader/content";

function readerHtml(overrides: Partial<ArticleReaderContentDto> = {}): ArticleReaderContentDto {
  return {
    contentStatus: "ready",
    contentSource: "feed_html",
    bodyKind: "html",
    contentBaseUrl: "https://example.com/posts/1",
    title: "Example",
    byline: null,
    excerpt: null,
    siteName: null,
    language: null,
    publishedTime: null,
    notice: null,
    extractionErrorCode: null,
    extractionErrorMessage: null,
    shouldExtract: false,
    contentHtml: "<p>Hello</p>",
    contentMarkdown: null,
    contentText: "Hello",
    fallbackSummary: null,
    fallbackReason: null,
    ...overrides,
  } as ArticleReaderContentDto;
}

describe("article reader contract", () => {
  test("selects extracted mode when extracted content is available", () => {
    const original = readerHtml();
    const extracted = readerHtml({
      contentSource: "extracted_html",
      contentHtml: "<p>Extracted</p>",
      contentText: "Extracted",
    });

    const reader = buildArticleReaderDto({
      readerOriginal: original,
      readerExtracted: extracted,
      extractedContentStatus: "ready",
      extractedContentError: null,
      extractedContentUpdatedAt: "2026-05-01T00:00:00.000Z",
    });

    expect(reader.activeMode).toBe("extracted");
    expect(reader.selected).toBe(extracted);
    expect(reader.original.available).toBe(true);
    expect(reader.extracted.available).toBe(true);
    expect(reader.extracted.status).toBe("ready");
  });

  test("selects original mode when extracted content is unavailable", () => {
    const original = readerHtml({
      bodyKind: "text",
      contentHtml: null,
      contentText: "Original fallback text",
      contentSource: "text_fallback",
    });

    const reader = buildArticleReaderDto({
      readerOriginal: original,
      readerExtracted: null,
      extractedContentStatus: "failed",
      extractedContentError: "No readable article body was found.",
      extractedContentUpdatedAt: "2026-05-01T00:00:00.000Z",
    });

    expect(reader.activeMode).toBe("original");
    expect(reader.selected).toBe(original);
    expect(reader.extracted.available).toBe(false);
    expect(reader.extracted.status).toBe("failed");
    expect(reader.extracted.error).toContain("No readable");
  });
});
