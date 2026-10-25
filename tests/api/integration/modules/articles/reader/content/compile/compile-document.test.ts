import { describe, expect, test } from "bun:test";
import {
  ARTICLE_COMPILER_VERSION,
  ARTICLE_DOCUMENT_PASSES,
  compileArticleDocument,
  compileArticleHtml,
} from "@kyomi/worker/document";
import { readerDocumentSchema } from "@kyomi/reader/document";
import { ARTICLE_HTML_SANITIZER_VERSION } from "@kyomi/worker/sanitization";

const BASE = "https://example.com/posts/entry";

describe("compileArticleDocument", () => {
  test("runs the Stage C passes in order", () => {
    expect(ARTICLE_DOCUMENT_PASSES.map((pass) => pass.name)).toEqual([
      "figures",
      "footnotes",
      "code",
      "math",
      "embeds",
      "normalize",
      "derive",
    ]);
  });

  test("returns sanitized html alongside a document that satisfies the schema", async () => {
    const body = `<h2>Hello</h2><p>World <b>wide</b></p><form><button>x</button></form>`;
    const result = await compileArticleDocument({ body, origin: "feed_html", baseUrl: BASE });
    expect(result.html).toBe(compileArticleHtml(body, { baseUrl: BASE }).html);
    expect(result.sanitizerVersion).toBe(ARTICLE_HTML_SANITIZER_VERSION);
    expect(result.compilerVersion).toBe(ARTICLE_COMPILER_VERSION);
    expect(result.documentVersion).toBe(1);
    expect(result.document).not.toBeNull();
    expect(readerDocumentSchema.safeParse(result.document).success).toBe(true);
    expect(result.document).toMatchObject({
      version: 1,
      source: { format: "html", origin: "feed_html", baseUrl: BASE },
      compiler: {
        version: ARTICLE_COMPILER_VERSION,
        sanitizerVersion: ARTICLE_HTML_SANITIZER_VERSION,
      },
      meta: { wordCount: 3, readingMinutes: 1, title: null, direction: "auto" },
    });
    expect(result.diagnostics.droppedElements).toEqual({ form: 1 });
    expect(result.diagnostics.htmlBlocks).toBe(0);
  });

  test("carries caller metadata into the document", async () => {
    const { document } = await compileArticleDocument({
      body: `<h1>My Post</h1><p>Body</p>`,
      origin: "feed_html",
      baseUrl: BASE,
      meta: {
        title: "My Post",
        siteName: "Example",
        language: "en",
        direction: "ltr",
        publishedAt: "2026-10-20T10:00:00.000Z",
        authors: [{ name: "Ada", url: "https://example.com/ada" }],
      },
    });
    expect(document?.meta).toMatchObject({
      title: "My Post",
      siteName: "Example",
      language: "en",
      direction: "ltr",
      publishedAt: "2026-10-20T10:00:00.000Z",
      authors: [{ name: "Ada", url: "https://example.com/ada" }],
    });
    expect(document?.blocks).toHaveLength(1);
  });

  test("compiles Markdown and plain text", async () => {
    const markdown = await compileArticleDocument({
      body: "## Hi\n\nSome **bold** text and `code`.",
      format: "markdown",
      origin: "feed_markdown",
    });
    expect(markdown.document?.source.format).toBe("markdown");
    expect(markdown.document?.blocks.map((block) => block.type)).toEqual(["heading", "paragraph"]);
    expect(markdown.html).toContain("<strong>bold</strong>");

    const text = await compileArticleDocument({
      body: "One\n\nTwo <b>&",
      format: "text",
      origin: "text_fallback",
    });
    expect(text.document?.blocks).toHaveLength(2);
    expect(text.html).toBe("<p>One</p>\n<p>Two &lt;b&gt;&amp;</p>");
  });

  test("never throws and still returns html when the source is too large", async () => {
    const body = `<p>${"x".repeat(4_100_000)}</p>`;
    const result = await compileArticleDocument({ body, origin: "feed_html" });
    expect(result.document).toBeNull();
    expect(result.diagnostics.warnings).toEqual(["source-too-large"]);
    expect(result.html.length).toBeGreaterThan(4_000_000);
  });

  test("ignores a base URL that is not http(s)", async () => {
    const result = await compileArticleDocument({
      body: "<p>ok</p>",
      origin: "feed_html",
      baseUrl: "not a url",
    });
    expect(result.document?.source.baseUrl).toBeNull();
  });

  test("handles empty and whitespace-only bodies", async () => {
    const result = await compileArticleDocument({ body: "  \n ", origin: "link_only" });
    expect(result.document).toMatchObject({
      blocks: [],
      meta: { wordCount: 0, readingMinutes: 0 },
    });
  });

  test("hostile markup compiles to a safe document", async () => {
    const result = await compileArticleDocument({
      body: `<p onclick="x()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">bad</a><img src="javascript:alert(1)"><iframe src="https://evil.example/"></iframe>`,
      origin: "feed_html",
      baseUrl: BASE,
    });
    expect(JSON.stringify(result.document)).not.toMatch(
      /javascript:|alert\(1\)|evil\.example|onclick/,
    );
    expect(result.document?.blocks[0]).toMatchObject({ type: "paragraph" });
  });

  test("flattens pathologically deep inline nesting instead of overflowing", async () => {
    const result = await compileArticleDocument({
      body: `<p>${"<b>".repeat(400)}deep${"</b>".repeat(400)}</p>`,
      origin: "feed_html",
    });
    expect(result.document).not.toBeNull();
    expect(JSON.stringify(result.document?.blocks)).toContain("deep");
  });

  test("does not rescan long text for unclosed math delimiters", async () => {
    const started = performance.now();
    const result = await compileArticleDocument({
      body: `<p>${"\\[ ".repeat(30_000)}</p><p>${"$$ ".repeat(5_000)}</p>`,
      origin: "feed_html",
    });
    expect(result.document).not.toBeNull();
    expect(performance.now() - started).toBeLessThan(5_000);
  });
});
