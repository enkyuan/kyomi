import { describe, expect, test } from "vitest";
import { readerContentSchema } from "./api-schemas";

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
});
