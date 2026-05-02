import { describe, expect, test } from "vitest";
import { articleDetailSchema, readerContentSchema } from "@lib/api-schemas";

const base = {
  contentStatus: "ready",
  contentSource: "feed_html",
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
};

describe("reader content schema contract", () => {
  test("accepts coherent html body payload", () => {
    const parsed = readerContentSchema.parse({
      ...base,
      bodyKind: "html",
      contentHtml: "<p>Hello</p>",
      contentMarkdown: null,
      contentText: "Hello",
      fallbackSummary: null,
      fallbackReason: null,
    });

    expect(parsed.bodyKind).toBe("html");
    expect(parsed.contentHtml).toBe("<p>Hello</p>");
  });

  test("rejects incoherent html payload without contentHtml", () => {
    const result = readerContentSchema.safeParse({
      ...base,
      bodyKind: "html",
      contentHtml: null,
      contentMarkdown: null,
      contentText: "Hello",
      fallbackSummary: null,
      fallbackReason: null,
    });
    expect(result.success).toBe(false);
  });

  test("accepts fallback payload only with explicit fallbackReason", () => {
    const parsed = readerContentSchema.parse({
      ...base,
      contentStatus: "failed",
      contentSource: "link_only",
      bodyKind: "fallback",
      contentHtml: null,
      contentMarkdown: null,
      contentText: null,
      fallbackSummary: "Fallback summary",
      fallbackReason: "missing_content",
    });

    expect(parsed.bodyKind).toBe("fallback");
    expect(parsed.fallbackReason).toBe("missing_content");
  });

  test("accepts canonical article reader contract with selected mode + availability", () => {
    const original = {
      ...base,
      bodyKind: "html" as const,
      contentHtml: "<p>Original</p>",
      contentMarkdown: null,
      contentText: "Original",
      fallbackSummary: null,
      fallbackReason: null,
    };
    const extracted = {
      ...base,
      contentSource: "extracted_html" as const,
      bodyKind: "html" as const,
      contentHtml: "<p>Extracted</p>",
      contentMarkdown: null,
      contentText: "Extracted",
      fallbackSummary: null,
      fallbackReason: null,
    };
    const parsed = articleDetailSchema.parse({
      id: "a1",
      title: "Example",
      link: "https://example.com/posts/1",
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
        original: { available: true, content: original },
        extracted: {
          available: true,
          content: extracted,
          status: "ready",
          error: null,
          updatedAt: "2026-05-01T00:00:00.000Z",
        },
      },
    });

    expect(parsed.reader.activeMode).toBe("extracted");
    expect(parsed.reader.selected.bodyKind).toBe("html");
    expect(parsed.reader.extracted.available).toBe(true);
  });
});
