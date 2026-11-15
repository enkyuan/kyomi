// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  ARTICLE_EMBED_PROVIDERS,
  normalizeSanitizedArticleRoot,
  sanitizeArticleHtmlFragment,
} from "@kyomi/reader/sanitization";
import { readerEmbedProviderSchema } from "@kyomi/reader/document";
import { sanitizeReaderArticleHtml } from "@kyomi/reader/web";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../../../..");

function viaPolicy(dirty: string): string {
  const tpl = document.createElement("template");
  tpl.innerHTML = sanitizeArticleHtmlFragment(dirty);
  normalizeSanitizedArticleRoot(tpl.content);
  return tpl.innerHTML;
}

const fixtures: Record<string, string> = {
  malicious: `<div onclick="alert(1)"><a href="javascript:alert(1)">bad</a><img src="x.png" onerror="alert(1)"/></div>`,
  structural: `<article><figure><img src="https://example.com/x.png" alt=""/><figcaption>Cap</figcaption></figure><blockquote>Quote</blockquote></article>`,
  code: `<pre><code class="language-ts prettyprint">const x: number = 1;</code></pre>`,
  table: `<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>`,
  mathml: `<span class="katex"><math><mrow><mi>x</mi></mrow></math></span>`,
  classFiltering: `<div class="author-bio promo sidebar ad-slot">Bio</div>`,
  image: `<img src="https://example.com/x.png" alt="alt text" width="100" height="50"/>`,
  relativeUrl: `<a href="https://example.com/relative/path">link</a><img src="https://example.com/relative/img.png" alt=""/>`,
  emptyWrapper: `<div><p></p><span>  </span></div>`,
  v2Semantics: `<p lang="en" dir="ltr"><b>b</b> <i>i</i> <s>s</s> <kbd>K</kbd> <q>q</q> <time datetime="2026-10-20">t</time></p><dl><dt>T</dt><dd>D</dd></dl><ruby>漢<rt>かん</rt></ruby>`,
  v2Tables: `<table><caption>C</caption><tbody><tr><td align="right" colspan="2">1</td><td></td></tr></tbody><tfoot><tr><td>F</td></tr></tfoot></table>`,
  v2Images: `<picture><source type="image/webp" srcset="https://cdn.example/w_1,f_webp/a.png 1x, javascript:alert(1) 2x"><img src="https://cdn.example/a.png" alt="" width="10" height="5" srcset="https://cdn.example/a@2x.png 2x"></picture>`,
  v2Media: `<video src="https://media.example/v.mp4" autoplay muted poster="data:text/html,x"></video><audio><source src="https://media.example/a.mp3" type="audio/mpeg"></audio><video src="javascript:alert(1)"></video>`,
  v2Anchors: `<p><a href="#kyomi-fn-1">1</a> <a href="#raw">raw</a></p><h2 id="location">x</h2><a id="kyomi-fnref-1"></a>`,
  v2Hints: `<pre data-kyomi-lang="ts" data-kyomi-lines="2"><code>a</code></pre><figure data-kyomi-embed="youtube" data-kyomi-url="https://www.youtube.com/watch?v=abc"><a href="https://www.youtube.com/watch?v=abc">v</a></figure><p data-kyomi-embed="x">p</p><li data-kyomi-checked="maybe">l</li>`,
  v2Math: `<math display="block"><msubsup><mi>x</mi><mi>i</mi><mn>2</mn></msubsup><mtable><mtr><mtd><mn>1</mn></mtd></mtr></mtable></math><math><annotation-xml encoding="text/html"><b>h</b></annotation-xml><maction><mi>z</mi></maction></math>`,
  v2Aside: `<aside class="note promo"><p>A</p></aside><blockquote><p>Q</p><footer>Author</footer></blockquote>`,
};

describe("sanitization policy parity", () => {
  test("exactly one ARTICLE_HTML_POLICY declaration exists across worker and reader", () => {
    const roots = [join(repoRoot, "packages/worker/src"), join(repoRoot, "packages/reader/src")];
    let occurrences = 0;
    const stack = [...roots];
    while (stack.length > 0) {
      const dir = stack.pop();
      if (!dir) continue;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (entry.isFile() && entry.name.endsWith(".ts")) {
          const contents = readFileSync(full, "utf8");
          occurrences += (contents.match(/const ARTICLE_HTML_POLICY\b/g) ?? []).length;
        }
      }
    }
    expect(occurrences).toBe(1);
  });

  test("the worker package keeps no sanitizer implementation of its own", () => {
    expect(() =>
      readFileSync(join(repoRoot, "packages/worker/src/sanitization/article-html.ts"), "utf8"),
    ).toThrow();
  });

  test("the policy's embed providers match the reader document model", () => {
    expect([...ARTICLE_EMBED_PROVIDERS]).toEqual(readerEmbedProviderSchema.options);
  });

  for (const [name, html] of Object.entries(fixtures)) {
    test(`${name}: browser reader sanitizer matches the canonical policy`, () => {
      expect(sanitizeReaderArticleHtml(html)).toBe(viaPolicy(html));
    });
  }
});
