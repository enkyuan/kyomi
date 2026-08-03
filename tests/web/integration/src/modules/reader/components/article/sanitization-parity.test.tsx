// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  normalizeSanitizedArticleRoot,
  sanitizeArticleHtmlFragment,
} from "@kyomi/worker/sanitization";
import { sanitizeReaderArticleHtml } from "@kyomi/reader/web";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../../../../..");

function viaWorkerPolicy(dirty: string): string {
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

  test("the reader package does not own a second sanitizer implementation file", () => {
    expect(() =>
      readFileSync(join(repoRoot, "packages/reader/src/sanitization/article-html.ts"), "utf8"),
    ).toThrow();
  });

  for (const [name, html] of Object.entries(fixtures)) {
    test(`${name}: browser reader sanitizer matches the canonical worker policy`, () => {
      expect(sanitizeReaderArticleHtml(html)).toBe(viaWorkerPolicy(html));
    });
  }
});
