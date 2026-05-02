import { describe, expect, test } from "vitest";
import type { ArticleDetailDto, ReaderContentDto } from "@lib/api-schemas";
import { readerContentForMode } from "@lib/reader-display";

function readerContent(overrides: Partial<ReaderContentDto> = {}): ReaderContentDto {
  return {
    contentStatus: "ready",
    contentSource: "feed_html",
    bodyKind: "html",
    contentBaseUrl: "https://example.com/post",
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
  } as ReaderContentDto;
}

function articleDetail(overrides: Partial<ArticleDetailDto> = {}): ArticleDetailDto {
  const original = readerContent();
  const extracted = readerContent({
    contentSource: "extracted_html",
    contentHtml: "<p>Extracted</p>",
    contentText: "Extracted",
  });
  return {
    id: "a1",
    title: "Title",
    link: "https://example.com/post",
    summary: null,
    publishedAt: "2026-05-01T00:00:00.000Z",
    feedId: "f1",
    feedTitle: "Feed",
    isRead: false,
    isSaved: false,
    articleType: "feed",
    contentHtml: null,
    contentText: null,
    contentMarkdown: null,
    contentStatus: "ready",
    contentSource: "feed_html",
    extractionErrorCode: null,
    extractionErrorMessage: null,
    reader: {
      activeMode: "extracted",
      selected: extracted,
      original: {
        available: true,
        content: original,
      },
      extracted: {
        available: true,
        content: extracted,
        status: "ready",
        error: null,
        updatedAt: "2026-05-01T00:00:00.000Z",
      },
    },
    ...overrides,
  };
}

describe("readerContentForMode", () => {
  test("returns requested original mode content directly", () => {
    const item = articleDetail();
    const selected = readerContentForMode(item, "original");
    expect(selected).toBe(item.reader.original.content);
  });

  test("returns extracted mode content when available", () => {
    const item = articleDetail();
    const selected = readerContentForMode(item, "extracted");
    expect(selected).toBe(item.reader.extracted.content);
  });

  test("falls back to server-selected payload when extracted mode unavailable", () => {
    const base = articleDetail();
    const item = articleDetail({
      reader: {
        ...base.reader,
        activeMode: "original",
        selected: base.reader.original.content,
        extracted: {
          available: false,
          content: null,
          status: "failed",
          error: "failed",
          updatedAt: null,
        },
      },
    });
    const selected = readerContentForMode(item, "extracted");
    expect(selected).toBe(item.reader.selected);
  });
});
