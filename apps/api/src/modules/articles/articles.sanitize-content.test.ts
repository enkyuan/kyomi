import { describe, expect, test } from "bun:test";
import { htmlToText, sanitizeArticleHtml } from "./articles.sanitize-content";

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
});
