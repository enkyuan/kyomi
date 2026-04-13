import { describe, expect, test } from "bun:test";
import {
  buildFallbackReaderContent,
  buildReadabilityReaderContent,
  buildStoredReaderContent,
} from "./articles.normalize-content";

describe("articles.normalize-content", () => {
  test("marks low-signal stored feed content as partial and extractable", () => {
    const reader = buildStoredReaderContent({
      articleType: "feed",
      title: "Haunt",
      summary:
        "CHEZ MOOSE TERMINAL MODEL IV * Phosphor Green P1 Amber P3 White Speed Slow Normal Fast Instant Flicker",
      legacyContent:
        "CHEZ MOOSE TERMINAL MODEL IV * Phosphor Green P1 Amber P3 White Speed Slow Normal Fast Instant Flicker",
      contentHtml: null,
      contentText: null,
      contentMarkdown: null,
      contentStatus: null,
      contentSource: null,
      extractionErrorCode: null,
      extractionErrorMessage: null,
    });

    expect(reader.contentStatus).toBe("partial");
    expect(reader.shouldExtract).toBe(true);
    expect(reader.bodyKind).toBe("text");
  });

  test("falls back to summary with a reader-safe notice after extraction failure", () => {
    const reader = buildFallbackReaderContent(
      {
        articleType: "feed",
        title: "Example",
        summary: "Short summary",
        legacyContent: null,
        contentHtml: null,
        contentText: null,
        contentMarkdown: null,
        contentStatus: null,
        contentSource: null,
        extractionErrorCode: null,
        extractionErrorMessage: null,
      },
      {
        code: "TIMEOUT",
        message: "Full preview unavailable right now.",
      },
    );

    expect(reader.contentStatus).toBe("partial");
    expect(reader.bodyKind).toBe("fallback");
    expect(reader.notice).toContain("Showing feed summary instead");
    expect(reader.extractionErrorCode).toBe("TIMEOUT");
  });

  test("promotes readability output to ready html content", () => {
    const reader = buildReadabilityReaderContent(
      {
        articleType: "feed",
        title: "Original title",
        summary: "Original summary",
        legacyContent: null,
        contentHtml: null,
        contentText: null,
        contentMarkdown: null,
        contentStatus: null,
        contentSource: null,
        extractionErrorCode: null,
        extractionErrorMessage: null,
      },
      {
        title: "Readability title",
        byline: "Author",
        excerpt: "Excerpt",
        contentHtml: "<p>Article body.</p><p>More body.</p>",
        contentText: "Article body.\n\nMore body.",
        siteName: "Example",
        language: "en",
        publishedTime: null,
      },
    );

    expect(reader.contentStatus).toBe("ready");
    expect(reader.contentSource).toBe("extracted_html");
    expect(reader.contentHtml).toContain("<p>Article body.</p>");
    expect(reader.shouldExtract).toBe(false);
  });

  test("returns link-only fallback when nothing usable exists", () => {
    const reader = buildStoredReaderContent({
      articleType: "feed",
      title: "Original title",
      summary: null,
      legacyContent: null,
      contentHtml: null,
      contentText: null,
      contentMarkdown: null,
      contentStatus: null,
      contentSource: null,
      extractionErrorCode: null,
      extractionErrorMessage: null,
    });

    expect(reader.contentStatus).toBe("failed");
    expect(reader.contentSource).toBe("link_only");
    expect(reader.bodyKind).toBe("fallback");
    expect(reader.notice).toContain("could not be previewed");
  });
});
