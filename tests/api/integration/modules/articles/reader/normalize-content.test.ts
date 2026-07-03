import { describe, expect, test } from "bun:test";
import {
  buildFallbackReaderContent,
  buildReadabilityReaderContent,
  buildStoredReaderContent,
  type ArticleStoredContentDto,
} from "@modules/articles/reader/content";

/*
 * Base input factory — all fields null/empty. Override only what each test cares about.
 */
function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    articleType: "feed" as const,
    title: "Test Article",
    summary: null as string | null,
    contentBaseUrl: "https://example.com/articles/test",
    legacyContent: null as string | null,
    contentHtml: null as string | null,
    contentText: null as string | null,
    contentMarkdown: null as string | null,
    contentStatus: null as ArticleStoredContentDto["contentStatus"] | null,
    contentSource: null as ArticleStoredContentDto["contentSource"] | null,
    extractionErrorCode: null as string | null,
    extractionErrorMessage: null as string | null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildStoredReaderContent — shouldExtract threshold edge cases
// ---------------------------------------------------------------------------
describe("articles.normalize.content", () => {
  describe("shouldExtractStoredContent thresholds", () => {
    test("marks low-signal stored feed content as partial and extractable", () => {
      const reader = buildStoredReaderContent(
        makeInput({
          summary:
            "CHEZ MOOSE TERMINAL MODEL IV * Phosphor Green P1 Amber P3 White Speed Slow Normal Fast Instant Flicker",
          legacyContent:
            "CHEZ MOOSE TERMINAL MODEL IV * Phosphor Green P1 Amber P3 White Speed Slow Normal Fast Instant Flicker",
        }),
      );

      expect(reader.contentStatus).toBe("partial");
      expect(reader.shouldExtract).toBe(true);
      expect(reader.bodyKind).toBe("text");
    });

    test("extracts when word count is exactly at the sub-40 boundary", () => {
      // 39 words — below 40 threshold → should extract
      const words39 = Array.from({ length: 39 }, (_, i) => `word${i}`).join(" ");
      const reader = buildStoredReaderContent(
        makeInput({ legacyContent: words39, summary: "Different summary" }),
      );
      expect(reader.shouldExtract).toBe(true);
    });

    test("does NOT extract when word count is at or above 40 with distinct summary", () => {
      // 41 words, HTML present, distinct from summary → should NOT extract
      const words41 = Array.from({ length: 41 }, (_, i) => `word${i}`).join(" ");
      const htmlContent = `<p>${words41}</p>`;
      const reader = buildStoredReaderContent(
        makeInput({
          contentHtml: htmlContent,
          contentText: words41,
          contentStatus: "ready",
          contentSource: "feed_html",
          summary: "Completely different summary text that shares no overlap.",
        }),
      );
      expect(reader.shouldExtract).toBe(false);
    });

    test("extracts when content echoes summary at sub-180 word boundary", () => {
      // Summary echo + under 180 words → should extract
      const summary = Array.from({ length: 50 }, (_, i) => `word${i}`).join(" ");
      const reader = buildStoredReaderContent(makeInput({ legacyContent: summary, summary }));
      expect(reader.shouldExtract).toBe(true);
    });

    test("does NOT extract summary echo when word count exceeds 180", () => {
      // Summary echo but over 180 words — the content is substantial enough
      const summary = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
      const extra = Array.from({ length: 130 }, (_, i) => `extra${i}`).join(" ");
      const content = `${summary} ${extra}`;
      const htmlContent = `<p>${content}</p>`;
      const reader = buildStoredReaderContent(
        makeInput({
          contentHtml: htmlContent,
          contentText: content,
          contentStatus: "ready",
          contentSource: "feed_html",
          summary,
        }),
      );
      expect(reader.shouldExtract).toBe(false);
    });

    test("extracts when content lacks HTML and has < 2 sentences and < 90 words", () => {
      // No HTML structural tags, 1 sentence, 50 words → should extract
      const content = Array.from({ length: 50 }, (_, i) => `word${i}`).join(" ") + ".";
      const reader = buildStoredReaderContent(
        makeInput({ legacyContent: content, summary: "Different summary" }),
      );
      expect(reader.shouldExtract).toBe(true);
    });

    test("does NOT extract when content has 2+ sentences even below 90 words", () => {
      // HTML present + 2 sentences + substantial words → should NOT extract
      const sentenceA = Array.from({ length: 24 }, (_, i) => `first${i}`).join(" ");
      const sentenceB = Array.from({ length: 24 }, (_, i) => `second${i}`).join(" ");
      const content = `${sentenceA}. ${sentenceB}.`;
      const htmlContent = `<p>${content}</p>`;
      const reader = buildStoredReaderContent(
        makeInput({
          contentHtml: htmlContent,
          contentText: content,
          contentStatus: "ready",
          contentSource: "feed_html",
          summary: "Completely different summary.",
        }),
      );
      expect(reader.shouldExtract).toBe(false);
    });

    test("never extracts clip articles", () => {
      const words20 = Array.from({ length: 20 }, (_, i) => `word${i}`).join(" ");
      const reader = buildStoredReaderContent(
        makeInput({
          articleType: "clip",
          legacyContent: words20,
          summary: "Different",
        }),
      );
      expect(reader.shouldExtract).toBe(false);
    });

    test("extracts when content is just 'comments' or 'Comments on ...'", () => {
      const reader1 = buildStoredReaderContent(
        makeInput({ legacyContent: "comments", summary: "Some summary" }),
      );
      expect(reader1.shouldExtract).toBe(true);

      const reader2 = buildStoredReaderContent(
        makeInput({ legacyContent: "Comments on this post", summary: "Some summary" }),
      );
      expect(reader2.shouldExtract).toBe(true);
    });

    test("classifies technical text with markdown code/list syntax as markdown", () => {
      const reader = buildStoredReaderContent(
        makeInput({
          contentText: "Deploy checklist:\n- `bun install`\n- `bun test`\n- `bun run build`",
          contentStatus: "ready",
          contentSource: "text_fallback",
        }),
      );
      expect(reader.bodyKind).toBe("markdown");
      expect(reader.contentMarkdown).toContain("`bun install`");
    });

    test("classifies fenced code blocks as markdown", () => {
      const reader = buildStoredReaderContent(
        makeInput({
          contentText: "```bash\nbun run test\n```",
          contentStatus: "ready",
          contentSource: "text_fallback",
        }),
      );
      expect(reader.bodyKind).toBe("markdown");
      expect(reader.contentMarkdown).toContain("```bash");
    });

    test("keeps clearly plain prose as text", () => {
      const reader = buildStoredReaderContent(
        makeInput({
          contentText:
            "This release contains stability improvements and reliability fixes across the sync pipeline.",
          contentStatus: "ready",
          contentSource: "text_fallback",
        }),
      );
      expect(reader.bodyKind).toBe("text");
      expect(reader.contentText).toContain("stability improvements");
    });

    test("classifies long heading-heavy markdown as markdown", () => {
      const markdown = Array.from(
        { length: 90 },
        (_, i) => `# Section ${i + 1}\n\nBody line ${i + 1}.`,
      ).join("\n\n");
      const reader = buildStoredReaderContent(
        makeInput({
          contentText: markdown,
          contentStatus: "ready",
          contentSource: "text_fallback",
        }),
      );
      expect(markdown.length).toBeGreaterThan(1800);
      expect(reader.bodyKind).toBe("markdown");
    });

    test("classifies markdown with single-line horizontal rule delimiters", () => {
      const reader = buildStoredReaderContent(
        makeInput({
          contentText: "# Changelog\n\n---\n\n### Added\n\n- New sync worker",
          contentStatus: "ready",
          contentSource: "text_fallback",
        }),
      );
      expect(reader.bodyKind).toBe("markdown");
    });

    test("classifies raw markdown wrapped in trivial html tags as markdown", () => {
      const reader = buildStoredReaderContent(
        makeInput({
          contentHtml:
            "<p># Changelog</p><p>---</p><p>### Added</p><p>- fixed parser edge case</p>",
          contentStatus: "ready",
          contentSource: "feed_html",
        }),
      );
      expect(reader.bodyKind).toBe("markdown");
      expect(reader.contentMarkdown).toContain("# Changelog");
      expect(reader.contentMarkdown).toContain("---");
    });
  });

  // ---------------------------------------------------------------------------
  // looksLikeSummaryEcho — the 48-char delta threshold
  // ---------------------------------------------------------------------------
  describe("looksLikeSummaryEcho 48-char delta", () => {
    test("treats identical content and summary as echo", () => {
      const text = "This is a short summary.";
      const reader = buildStoredReaderContent(makeInput({ legacyContent: text, summary: text }));
      // Short + echo → extract
      expect(reader.shouldExtract).toBe(true);
    });

    test("treats near-identical content (within 48 chars) as echo", () => {
      const summary = "This is the original summary text for testing.";
      const content = summary + " extra"; // +6 chars, well within 48
      const reader = buildStoredReaderContent(makeInput({ legacyContent: content, summary }));
      expect(reader.shouldExtract).toBe(true);
    });

    test("does NOT treat content as echo when delta exceeds 48 chars", () => {
      const summary = "Short summary.";
      const extra = "A".repeat(60); // 60 char delta
      const content = `${summary} ${extra}`;
      // Still under 40 words though, so it'll extract for that reason
      // Let's make it long enough to bypass the word-count threshold:
      const baseContent = Array.from({ length: 50 }, (_, i) => `word${i}`).join(" ");
      const fullContent = `${baseContent} ${extra}`;
      const htmlContent = `<p>${fullContent}</p>`;

      const reader = buildStoredReaderContent(
        makeInput({
          contentHtml: htmlContent,
          contentText: fullContent,
          contentStatus: "ready",
          contentSource: "feed_html",
          summary,
        }),
      );
      // Content is 50+ words, distinct from summary, has HTML → should NOT extract
      expect(reader.shouldExtract).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // buildFallbackReaderContent edge cases
  // ---------------------------------------------------------------------------
  describe("buildFallbackReaderContent", () => {
    test("falls back to summary with a reader-safe notice after extraction failure", () => {
      const reader = buildFallbackReaderContent(makeInput({ summary: "Short summary" }), {
        code: "TIMEOUT",
        message: "Full preview unavailable right now.",
      });

      expect(reader.contentStatus).toBe("partial");
      expect(reader.bodyKind).toBe("fallback");
      expect(reader.notice).toContain("Showing feed summary instead");
      expect(reader.extractionErrorCode).toBe("TIMEOUT");
    });

    test("falls back to link-only when no summary exists", () => {
      const reader = buildFallbackReaderContent(makeInput({}), {
        code: "FETCH_FAILED",
        message: "Connection refused",
      });

      expect(reader.contentStatus).toBe("failed");
      expect(reader.bodyKind).toBe("fallback");
      expect(reader.contentSource).toBe("link_only");
      expect(reader.notice).toContain("could not be previewed");
    });

    test("preserves existing stored content when extraction fails", () => {
      const reader = buildFallbackReaderContent(
        makeInput({
          contentHtml: "<p>Previously extracted content.</p>",
          contentText: "Previously extracted content.",
          contentStatus: "ready",
          contentSource: "extracted_html",
        }),
        { code: "TIMEOUT", message: "Preview timed out." },
      );

      // Should keep existing content, just update error fields
      expect(reader.contentHtml).toBe("<p>Previously extracted content.</p>");
      expect(reader.extractionErrorCode).toBe("TIMEOUT");
    });
  });

  // ---------------------------------------------------------------------------
  // buildReadabilityReaderContent edge cases
  // ---------------------------------------------------------------------------
  describe("buildReadabilityReaderContent", () => {
    test("promotes readability output to ready html content", () => {
      const reader = buildReadabilityReaderContent(makeInput({}), {
        title: "Readability title",
        byline: "Author",
        excerpt: "Excerpt",
        contentHtml: "<p>Article body.</p><p>More body.</p>",
        contentText: "Article body.\n\nMore body.",
        siteName: "Example",
        language: "en",
        publishedTime: null,
      });

      expect(reader.contentStatus).toBe("ready");
      expect(reader.contentSource).toBe("extracted_html");
      expect(reader.contentHtml).toContain("<p>Article body.</p>");
      expect(reader.shouldExtract).toBe(false);
    });

    test("uses readability byline and excerpt in the reader", () => {
      const reader = buildReadabilityReaderContent(makeInput({}), {
        title: "Title",
        byline: "Jane Doe",
        excerpt: "A short excerpt of the article.",
        contentHtml: "<p>Real content.</p>",
        contentText: "Real content.",
        siteName: null,
        language: null,
        publishedTime: "2024-01-15T10:00:00Z",
      });

      expect(reader.byline).toBe("Jane Doe");
      expect(reader.excerpt).toBe("A short excerpt of the article.");
      expect(reader.publishedTime).toBe("2024-01-15T10:00:00Z");
    });

    test("strips redundant leading source headline and metadata from readability html", () => {
      const reader = buildReadabilityReaderContent(
        makeInput({
          title: "Germany says US troop withdrawal 'foreseeable' as Trump warns of more 'cuts'",
          summary: "A short summary.",
        }),
        {
          title: "Germany says US troop withdrawal 'foreseeable' as Trump warns of more 'cuts'",
          byline: "Jaroslav Lukiv",
          excerpt: "A short summary.",
          contentHtml: `
            <h1>Germany says US troop withdrawal 'foreseeable' as Trump warns of more 'cuts'</h1>
            <p>1 hour ago</p>
            <p>Jaroslav Lukiv</p>
            <p>Body paragraph starts here.</p>
          `,
          contentText: "Body paragraph starts here.",
          siteName: null,
          language: null,
          publishedTime: null,
        },
      );

      expect(reader.contentHtml).not.toContain("<h1>");
      expect(reader.contentHtml).not.toContain("Jaroslav Lukiv");
      expect(reader.contentHtml).not.toContain("1 hour ago");
      expect(reader.contentHtml).toContain("Body paragraph starts here.");
    });

    test("strips nested publisher header scaffolding from readability html", () => {
      const reader = buildReadabilityReaderContent(
        makeInput({
          title: "Germany says US troop withdrawal 'foreseeable' as Trump warns of more 'cuts'",
          summary: "A short summary.",
        }),
        {
          title: "Germany says US troop withdrawal 'foreseeable' as Trump warns of more 'cuts'",
          byline: "Jaroslav Lukiv",
          excerpt: "A short summary.",
          contentHtml: `
            <div><div><article>
              <div><h2>Germany says US troop withdrawal 'foreseeable' as Trump warns of more 'cuts'</h2></div>
              <div><p>1 hour ago</p><p></p><div><p><span>Jaroslav Lukiv</span></p></div></div>
              <div><figure><img src="https://example.com/photo.jpg" alt=""></figure></div>
              <div><p>Body paragraph starts here.</p></div>
            </article></div></div>
          `,
          contentText: "Body paragraph starts here.",
          siteName: null,
          language: null,
          publishedTime: null,
        },
      );

      expect(reader.contentHtml).not.toContain("<h2>");
      expect(reader.contentHtml).not.toContain("Jaroslav Lukiv");
      expect(reader.contentHtml).not.toContain("1 hour ago");
      expect(reader.contentHtml).toContain("<figure>");
      expect(reader.contentHtml).toContain("Body paragraph starts here.");
    });

    test("returns link-only fallback when nothing usable exists", () => {
      const reader = buildStoredReaderContent(makeInput({}));

      expect(reader.contentStatus).toBe("failed");
      expect(reader.contentSource).toBe("link_only");
      expect(reader.bodyKind).toBe("fallback");
      expect(reader.notice).toContain("could not be previewed");
    });

    test("strips redundant leading source headline and metadata from stored html", () => {
      const reader = buildStoredReaderContent(
        makeInput({
          title: "Germany says US troop withdrawal 'foreseeable' as Trump warns of more 'cuts'",
          summary: "A short summary.",
          contentHtml: `
            <h1>Germany says US troop withdrawal 'foreseeable' as Trump warns of more 'cuts'</h1>
            <p>2 hours ago</p>
            <p>Jaroslav Lukiv</p>
            <p>Body paragraph starts here.</p>
          `,
          contentText: "Body paragraph starts here.",
          contentStatus: "ready",
          contentSource: "feed_html",
        }),
      );

      expect(reader.contentHtml).not.toContain("<h1>");
      expect(reader.contentHtml).not.toContain("Jaroslav Lukiv");
      expect(reader.contentHtml).not.toContain("2 hours ago");
      expect(reader.contentHtml).toContain("Body paragraph starts here.");
    });
  });
});
