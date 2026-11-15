import { describe, expect, test } from "bun:test";
import { ARTICLE_COMPILE_PASSES, compileArticleHtml } from "@kyomi/worker/document";
import { ARTICLE_HTML_SANITIZER_VERSION } from "@kyomi/reader/sanitization";
import { canonicalHtml } from "./run-pass";

describe("compileArticleHtml", () => {
  test("runs the ingest passes in order", () => {
    expect(ARTICLE_COMPILE_PASSES.map((pass) => pass.name)).toEqual([
      "strip-reserved",
      "unlazy-media",
      "resolve-urls",
      "recognize-embeds",
      "capture-code-hints",
      "capture-layout",
      "strip-chrome",
      "sanitize",
    ]);
  });

  test("turns a raw feed body into stored, sanitized HTML with diagnostics", () => {
    const result = compileArticleHtml(
      `<p data-kyomi-url="javascript:alert(1)">Intro<sup><a href="#fn1">1</a></sup></p>
       <img src="data:image/gif;base64,R0" data-src="/a.jpg" alt="A" width="800" height="400">
       <figure><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Demo"></iframe></figure>
       <div class="language-py"><pre><code>print(1)</code></pre></div>
       <form><button>Subscribe</button></form>
       <ol><li id="fn1">Note</li></ol>`,
      { baseUrl: "https://example.com/posts/entry" },
    );

    const html = canonicalHtml(result.html);

    expect(result.sanitizerVersion).toBe(ARTICLE_HTML_SANITIZER_VERSION);
    expect(html).toContain('<p>Intro<sup><a href="#kyomi-fn1">1</a></sup></p>');
    expect(html).toContain('src="https://example.com/a.jpg"');
    expect(html).toContain('height="400"');
    expect(html).toContain('width="800"');
    expect(html).toContain(
      '<figure data-kyomi-embed="youtube" data-kyomi-url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"><a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Demo</a></figure>',
    );
    expect(html).toContain('<pre data-kyomi-lang="py"><code>print(1)</code></pre>');
    expect(html).toContain('<li id="kyomi-fn1">Note</li>');
    expect(html).not.toMatch(/Subscribe|javascript:|<iframe|<form/);
    expect(result.diagnostics.droppedElements).toEqual({ form: 1 });
  });

  test("is stable when recompiling its own output", () => {
    const raw = `<p>A<a href="#n">1</a></p><p id="n">N</p><pre class="language-ts"><code>x</code></pre>`;
    const first = compileArticleHtml(raw, { baseUrl: "https://example.com/" });
    const second = compileArticleHtml(first.html, { baseUrl: "https://example.com/" });

    expect(canonicalHtml(second.html)).toBe(canonicalHtml(first.html));
    expect(canonicalHtml(first.html)).toContain('<p id="kyomi-n">N</p>');
  });
});
