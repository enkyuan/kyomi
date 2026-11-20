// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { detectCodeLanguage } from "@kyomi/reader/core";
import { prepareArticleHtml } from "../../../../../../packages/reader/src/web/html/string-prep";
import {
  hasLikelyDelimitedTex,
  hasLikelyMarkdownMath,
} from "../../../../../../packages/reader/src/shared/math";
import { stripDangerousMarkupForWebViewFragment } from "@kyomi/reader/webview";
import { readerMarkdownToHtmlWithKatex } from "../../../../../../packages/reader/src/shared/markdown-katex";

/**
 * A stored article is attacker-controlled, and the reader scans it on the main thread. Each hostile
 * input below made a regex rescan the rest of the text from every position (quadratic): seconds to
 * minutes at 100 KB to 1 MB. The linear scans take milliseconds, so the budget is generous (it must
 * also hold on a loaded machine) yet far below the quadratic cost.
 */
const BUDGET_MS = 1_000;

function elapsed(run: () => unknown): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}

/** Deterministic pseudo-random numbers, so a failing differential case reproduces. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomText(next: () => number, tokens: readonly string[], maxTokens: number): string {
  let text = "";
  for (let count = Math.floor(next() * maxTokens) + 1; count > 0; count -= 1) {
    text += tokens[Math.floor(next() * tokens.length)];
  }
  return text;
}

describe("delimited math detection", () => {
  // The regexes the linear scans replace, kept here as the reference behavior.
  const reference = (value: string) =>
    /(^|[^\\])\$\$[\s\S]+?(^|[^\\])\$\$/m.test(value) ||
    /\\\([\s\S]+?\\\)/.test(value) ||
    /\\\[[\s\S]+?\\\]/.test(value) ||
    /\\begin\{[a-zA-Z*]+\}/.test(value);

  test.each([
    ["inline parentheses", String.raw`so \(x^2\) holds`, true],
    ["display brackets", String.raw`\[ x = 1 \]`, true],
    ["dollar pair", "a $$x+y$$ b", true],
    ["dollar pair across lines", "$$\nx\n$$", true],
    ["environment", String.raw`\begin{align} x \end{align}`, true],
    ["escaped dollars", String.raw`price \$$5 and \$$6`, false],
    ["unclosed opener", String.raw`\( never closed`, false],
    ["empty pair", String.raw`\(\)`, false],
    ["plain prose", "no math here, only a $5 price", false],
  ])("%s", (_name, text, expected) => {
    expect(hasLikelyDelimitedTex(text)).toBe(expected);
  });

  test("agrees with the regexes it replaces on 5000 random texts", () => {
    const next = random(7);
    const tokens = [
      "$$",
      "$",
      "\\(",
      "\\)",
      "\\[",
      "\\]",
      "\\",
      "\n",
      "\r",
      "x",
      " ",
      "\\begin{a}",
      "{",
    ];
    for (let index = 0; index < 5_000; index += 1) {
      const text = randomText(next, tokens, 9);
      expect(hasLikelyDelimitedTex(text), JSON.stringify(text)).toBe(reference(text));
    }
  });

  test.each([
    ["unclosed \\(", String.raw`\(`.repeat(100_000)],
    ["unclosed \\[", String.raw`\[`.repeat(100_000)],
    ["openers each followed by a stray closer", String.raw`\\(`.repeat(100_000)],
    ["escaped dollar pairs", String.raw`\$$`.repeat(100_000)],
    ["unclosed $$ after text", "a$$".repeat(100_000)],
  ])("stays linear on %s", (_name, text) => {
    expect(elapsed(() => hasLikelyDelimitedTex(text))).toBeLessThan(BUDGET_MS);
    expect(elapsed(() => hasLikelyMarkdownMath(text))).toBeLessThan(BUDGET_MS);
  });
});

describe("article preparation", () => {
  test("a text node full of unclosed \\( does not freeze the reader", () => {
    const html = `<p>${String.raw`\(`.repeat(120_000)}</p>`;
    expect(elapsed(() => prepareArticleHtml(html))).toBeLessThan(BUDGET_MS * 2);
  });

  test("a long run of spaces in a figcaption does not freeze the reader", () => {
    const html = `<figure><img src="https://cdn.example/a.png" alt=""><figcaption>a${" ".repeat(60_000)}b</figcaption></figure>`;
    expect(elapsed(() => prepareArticleHtml(html))).toBeLessThan(BUDGET_MS);
  });

  test("many escaped <code> wrapper openers without closers do not freeze the reader", () => {
    // In a comment, so the cost measured is the string pass, not building 60,000 elements.
    const html = `<p>x</p><!--${"<code>&lt;code&gt;".repeat(60_000)}-->`;
    expect(elapsed(() => prepareArticleHtml(html))).toBeLessThan(BUDGET_MS);
  });

  test("still unwraps a redundant inline code wrapper, in either spelling", () => {
    expect(prepareArticleHtml("<p><code>&lt;code&gt;Foo&lt;/code&gt;</code></p>")).toBe(
      "<p><code>Foo</code></p>",
    );
    expect(prepareArticleHtml("<p><CODE>&LT;CODE&GT;Foo&LT;/CODE&GT;</CODE></p>")).toBe(
      "<p><code>Foo</code></p>",
    );
    expect(
      prepareArticleHtml(
        "<p><code>&lt;code&gt;A&lt;/code&gt;</code> and <code>&lt;code&gt;B&lt;/code&gt;</code></p>",
      ),
    ).toBe("<p><code>A</code> and <code>B</code></p>");
    // An opener without its closer is left as written.
    expect(prepareArticleHtml("<p><code>&lt;code&gt;Foo</code></p>")).toBe(
      "<p><code>&lt;code&gt;Foo</code></p>",
    );
  });

  test("normalizes caption punctuation spacing as before", () => {
    const html =
      '<figure><img src="https://cdn.example/a.png" alt=""><figcaption>  Photo :  Jane ;  Roe\n\n: Ltd ;</figcaption></figure>';
    expect(prepareArticleHtml(html)).toContain("<figcaption>Photo: Jane; Roe: Ltd;</figcaption>");
  });

  test("leaves text inside explicit math delimiters alone and rewrites bare TeX", () => {
    expect(prepareArticleHtml(String.raw`<p>keep \(α_{1}\) here</p>`)).toBe(
      String.raw`<p>keep \(α_{1}\) here</p>`,
    );
    expect(prepareArticleHtml(String.raw`<p>bare α_{1} here</p>`)).toBe(
      String.raw`<p>bare \(α_{1}\) here</p>`,
    );
  });
});

describe("WebView fragment hardening", () => {
  const reference = (html: string) =>
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<script\b[^>]*\/>/gi, "")
      .replace(/\son[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  test.each([
    ["script element", "<p>a</p><script>evil()</script><p>b</p>", "<p>a</p><p>b</p>"],
    ["upper case, with attributes", '<SCRIPT src="x" >1</Script><b>k</b>', "<b>k</b>"],
    ["self-closed script", '<p>a</p><script src="x"/><p>b</p>', "<p>a</p><p>b</p>"],
    ["two scripts", "<script>1</script>mid<script>2</script>", "mid"],
    ["event handlers", '<img src="x" onerror="evil()" ONLOAD=go>', '<img src="x">'],
    ["unclosed script is left for the sanitizer", "<p>a</p><script>1", "<p>a</p><script>1"],
    ["not a script tag", "<scripted>x</scripted>", "<scripted>x</scripted>"],
  ])("%s", (_name, html, expected) => {
    expect(stripDangerousMarkupForWebViewFragment(html)).toBe(expected);
    expect(reference(html)).toBe(expected);
  });

  test("agrees with the regexes it replaces on 5000 random fragments", () => {
    const next = random(11);
    const tokens = [
      "<script",
      "<SCRIPT",
      "</script>",
      "</SCRIPT>",
      "<script/>",
      "/>",
      ">",
      "<",
      "/",
      " ",
      "x",
      "=",
      '"',
      " onclick=1",
      " onerror='a'",
      "<p>",
      "<scripts>",
      "\n",
    ];
    for (let index = 0; index < 5_000; index += 1) {
      const html = randomText(next, tokens, 10);
      expect(stripDangerousMarkupForWebViewFragment(html), JSON.stringify(html)).toBe(
        reference(html),
      );
    }
  });

  test.each([
    ["<script  with no end", "<script ".repeat(20_000)],
    ["<script> with no closer", "<script>".repeat(20_000)],
    ["<script/ without >", "<script/".repeat(20_000)],
    ["tags that never end", "<script x".repeat(20_000)],
  ])("stays linear on %s", (_name, html) => {
    expect(elapsed(() => stripDangerousMarkupForWebViewFragment(html))).toBeLessThan(BUDGET_MS);
  });
});

describe("code language detection", () => {
  test.each([
    ["an HTML document fragment", "<div class='a'>\n  <p>hi</p>\n</div>", "xml"],
    ["a self-contained tag pair", "<a>x</a>", "xml"],
    ["namespaced tags", "<svg:rect width='1'></svg:rect>", "xml"],
    ["a python import with a print", "import os\nprint(os.name)", "python"],
    ["a python from-import after blank lines", "\n\n  from a import b\nx = None", "python"],
    [
      "an indented python import in the middle",
      "x = 1\n\n   \n  from a import b\nprint(1)",
      "python",
    ],
  ])("still detects %s", (_name, code, language) => {
    expect(detectCodeLanguage(code).language).toBe(language);
  });

  test("an opening tag without a closing tag is not markup", () => {
    expect(detectCodeLanguage("a < b and <b> c").reason).not.toBe("paired markup tags");
  });

  test("agrees with the markup regex it replaces on 3000 random snippets", () => {
    const next = random(3);
    const tokens = ["<", ">", "/", "a", "b1", " ", "\t", ":", "-", "x", "\n", "</a>", "<b>", "="];
    const reference = (text: string) =>
      /<[a-z][\w:-]*(\s[^>]*)?>[\s\S]*<\/[a-z][\w:-]*>/i.test(text.trim());
    for (let index = 0; index < 3_000; index += 1) {
      const text = randomText(next, tokens, 12);
      if (!text.trim()) {
        continue;
      }
      expect(detectCodeLanguage(text).reason === "paired markup tags", JSON.stringify(text)).toBe(
        reference(text),
      );
    }
  });

  test.each([
    ["opening tags", "<a>".repeat(40_000)],
    ["opening tags with attributes", "<a ".repeat(40_000)],
    ["blank lines", `a${"\n".repeat(60_000)}b`],
    ["import statements", "import ".repeat(30_000)],
    ["python definitions", "def a(".repeat(30_000)],
  ])("stays fast on %s", (_name, code) => {
    expect(elapsed(() => detectCodeLanguage(code))).toBeLessThan(BUDGET_MS / 2);
  });

  test("a huge valid JSON document is still recognized in full", () => {
    const json = JSON.stringify({ items: Array.from({ length: 4_000 }, (_, id) => ({ id })) });
    expect(json.length).toBeGreaterThan(20_000);
    expect(detectCodeLanguage(json).language).toBe("json");
  });
});

describe("language hints from a publisher", () => {
  test.each(["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"])(
    "%s is just an unknown language",
    (hint) => {
      const result = detectCodeLanguage("x", hint);
      expect(result.language).toBe(hint.toLowerCase());
      expect(typeof result.label).toBe("string");
      expect(result.confidence).toBe("explicit");
    },
  );

  test("known aliases and labels still apply", () => {
    expect(detectCodeLanguage("x", "TS")).toMatchObject({
      language: "typescript",
      label: "TypeScript",
    });
  });
});

describe("Markdown math", () => {
  test("still renders delimited math", () => {
    expect(readerMarkdownToHtmlWithKatex("Euler: $e^{i\\pi}+1=0$ and $$x^2$$")).toContain(
      'class="katex"',
    );
  });

  test.each([
    ["environments with no end", String.raw`\begin{a}`.repeat(50_000)],
    ["display delimiters with no end", String.raw`\[`.repeat(150_000)],
  ])("a long paragraph of %s is not scanned quadratically", (_name, paragraph) => {
    expect(elapsed(() => readerMarkdownToHtmlWithKatex(paragraph))).toBeLessThan(BUDGET_MS);
  });

  test("a paragraph longer than the scan limit keeps its text and its delimiters", () => {
    const paragraph = `${"filler ".repeat(4_000)} $x^2$`;
    expect(paragraph.length).toBeGreaterThan(20_000);
    const html = readerMarkdownToHtmlWithKatex(paragraph);
    expect(html).toContain("$x^2$");
    expect(html).not.toContain('class="katex"');
  });
});
