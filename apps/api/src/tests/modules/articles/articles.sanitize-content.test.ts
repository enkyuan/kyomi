import { describe, expect, test } from "bun:test";
import { htmlToText, sanitizeArticleHtml } from "@modules/articles/articles.sanitize-content";

describe("articles.sanitize-content", () => {
  test("preserves headings, lists, code blocks, tables, and strips scripts", () => {
    const sanitized = sanitizeArticleHtml(`
      <article>
        <h1>Title</h1>
        <p>Intro</p>
        <script>alert("x")</script>
        <ul><li>One</li><li>Two</li></ul>
        <pre><code class="language-ts">const x = 1;</code></pre>
        <table><thead><tr><th>A</th></tr></thead><tbody><tr><td>B</td></tr></tbody></table>
      </article>
    `);

    expect(sanitized).toContain("<h1>Title</h1>");
    expect(sanitized).toContain("<ul><li>One</li><li>Two</li></ul>");
    expect(sanitized).toContain('<pre><code class="language-ts">const x = 1;</code></pre>');
    expect(sanitized).toContain("<table>");
    expect(sanitized).not.toContain("<script>");

    const text = htmlToText(sanitized);
    expect(text).toContain("Title");
    expect(text).toContain("const x = 1;");
    expect(text).toContain("One");
  });

  test("resolves relative links/images against base URL and strips unsafe schemes", () => {
    const sanitized = sanitizeArticleHtml(
      `
      <p><a href="/docs/start">Start</a></p>
      <img src="../assets/diagram.png" alt="diagram">
      <a href="javascript:alert(1)">bad</a>
      `,
      { baseUrl: "https://example.com/posts/2026/update" },
    );

    expect(sanitized).toContain('href="https://example.com/docs/start"');
    expect(sanitized).toContain('src="https://example.com/posts/assets/diagram.png"');
    expect(sanitized).not.toContain("javascript:");
  });

  test("preserves div-based author layout, filtered classes, and strips scripts", () => {
    const sanitized = sanitizeArticleHtml(`
      <div class="author-bio media-object wp-block-group">
        <img src="https://example.com/a.png" alt="Author" class="avatar photo" />
        <div class="bio-text">
          <p class="name">Author Name</p>
          <p>Short bio.</p>
          <a href="https://example.com/profile" class="button promo-link">Profile</a>
        </div>
      </div>
      <script>alert(1)</script>
    `);

    expect(sanitized).toContain("<div");
    expect(sanitized).toContain("author-bio");
    expect(sanitized).toContain("media-object");
    expect(sanitized).toContain("wp-block-group");
    expect(sanitized).toContain("avatar");
    expect(sanitized).toContain("<img");
    expect(sanitized).toContain("Author Name");
    expect(sanitized).not.toContain("<script>");
    expect(sanitized).not.toContain("promo");
  });

  test("strips TypeDoc data-tsd-* attributes and empty style on allowed tags", () => {
    const sanitized = sanitizeArticleHtml(`
      <div class="article-body" data-tsd-source="/src/components/foo.ts" style="">
        <p>Hello</p>
      </div>
    `);

    expect(sanitized).not.toContain("data-tsd-source");
    expect(sanitized).not.toContain("tsd-source");
    expect(sanitized).toContain("<p>Hello</p>");
  });
});

describe("articles.sanitize-content – carousel artifact stripping", () => {
  test("removes lists where every item is a single bullet character", () => {
    const html = `
      <p>Real content.</p>
      <ul>
        <li>•</li>
        <li>•</li>
        <li>•</li>
      </ul>
      <p>More content.</p>
    `;
    const result = sanitizeArticleHtml(html);
    expect(result).not.toContain("<ul");
    expect(result).not.toContain("<li");
    expect(result).toContain("Real content");
    expect(result).toContain("More content");
  });

  test("preserves bare-numbered <ol> (legitimate ordered list)", () => {
    const html = `
      <ol>
        <li>1</li>
        <li>2</li>
        <li>3</li>
      </ol>
      <p>Article text.</p>
    `;
    const result = sanitizeArticleHtml(html);
    expect(result).toContain("<ol");
    expect(result).toContain("Article text");
  });

  test("removes bare-numbered <ul> (carousel pagination dots)", () => {
    const html = `
      <ul>
        <li>1</li>
        <li>2</li>
        <li>3</li>
      </ul>
      <p>Article text.</p>
    `;
    const result = sanitizeArticleHtml(html);
    expect(result).not.toContain("<ul");
    expect(result).toContain("Article text");
  });

  test("removes empty lists", () => {
    const html = `
      <ul></ul>
      <p>Content.</p>
    `;
    const result = sanitizeArticleHtml(html);
    expect(result).not.toContain("<ul");
    expect(result).toContain("Content");
  });

  test("preserves lists with real text content", () => {
    const html = `
      <ul>
        <li>First important point about the topic at hand.</li>
        <li>Second important point with supporting detail.</li>
        <li>Third point wrapping up the argument.</li>
      </ul>
    `;
    const result = sanitizeArticleHtml(html);
    expect(result).toContain("<ul");
    expect(result).toContain("First important point");
  });

  test("removes lists with single unicode dot characters (●, ○, ◦)", () => {
    const html = `
      <ul>
        <li>●</li>
        <li>○</li>
        <li>◦</li>
      </ul>
    `;
    const result = sanitizeArticleHtml(html);
    expect(result).not.toContain("<ul");
  });

  test("preserves mixed lists where some items have real text", () => {
    const html = `
      <ul>
        <li>1. Install the software</li>
        <li>2. Configure the settings</li>
        <li>3. Run the demo</li>
      </ul>
    `;
    const result = sanitizeArticleHtml(html);
    expect(result).toContain("<ul");
    expect(result).toContain("Install the software");
  });

  test("removes lists with carousel CSS classes even if items have text", () => {
    const html = `
      <ul class="carousel-dots">
        <li>slide one</li>
        <li>slide two</li>
      </ul>
    `;
    const result = sanitizeArticleHtml(html);
    expect(result).not.toContain("carousel");
  });
});
