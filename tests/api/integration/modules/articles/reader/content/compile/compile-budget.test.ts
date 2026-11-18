import { describe, expect, test } from "bun:test";
import { compileArticleDocument, compileArticleHtml } from "@kyomi/ingest/document";
import {
  highlightCode,
  MAX_DOCUMENT_HIGHLIGHT_MS,
} from "../../../../../../../../packages/ingest/src/document/highlighter";

/**
 * The compiler runs on the API thread for a signed-in user's clip and in the feed worker for a
 * publisher's feed, and it never yields inside a pass. These pin the work an article can cost to a
 * budget that does not depend on how hostile its shape is.
 */

const BASE = "https://example.com/posts/entry";
type Block = { type: string; highlight?: unknown };

function codeBlocks(document: { blocks: Block[] } | null): Block[] {
  return (document?.blocks ?? []).filter((block) => block.type === "code");
}

/** A block whose lines are an unterminated template literal: the worst case for the tokenizer. */
const hostileBlock = (lines: number) =>
  `<pre><code class="language-javascript">${Array.from(
    { length: lines },
    () => `x = ${"${a ".repeat(50)}`,
  ).join("\n")}</code></pre>`;

describe("highlighting budget", () => {
  test("a document of hostile code blocks stops colouring after its budget and stays fast", async () => {
    const body = Array.from({ length: 40 }, () => hostileBlock(30)).join("");
    expect(body.length).toBeLessThan(1_048_576);

    const started = performance.now();
    const { document } = await compileArticleDocument({ body, origin: "feed_html", baseUrl: BASE });
    const elapsed = performance.now() - started;

    const blocks = codeBlocks(document as { blocks: Block[] } | null);
    expect(blocks).toHaveLength(40);
    expect(blocks.filter((block) => block.highlight).length).toBeLessThanOrEqual(5);
    expect(elapsed).toBeLessThan(5_000);
  });

  test("ordinary code is still coloured", async () => {
    const snippet = Array.from(
      { length: 200 },
      (_, line) => `const value${line} = compute(${line}, "label ${line}");`,
    ).join("\n");

    const { document } = await compileArticleDocument({
      body: `<pre><code class="language-javascript">${snippet}</code></pre>`,
      origin: "feed_html",
      baseUrl: BASE,
    });

    const [block] = codeBlocks(document as { blocks: Block[] } | null);
    expect(block?.highlight).toBeTruthy();
  });

  test("the first blocks of a long article keep their colour while later ones go plain", async () => {
    const snippet = Array.from({ length: 40 }, (_, line) => `const v${line} = ${line};`).join("\n");
    const block = `<pre><code class="language-javascript">${snippet}</code></pre>`;

    const { document } = await compileArticleDocument({
      body: Array.from({ length: 60 }, () => block).join(""),
      origin: "feed_html",
      baseUrl: BASE,
    });

    const blocks = codeBlocks(document as { blocks: Block[] } | null);
    expect(blocks[0]?.highlight).toBeTruthy();
    expect(blocks.at(-1)?.highlight).toBeUndefined();
  });
});

describe("compile passes scale linearly", () => {
  const time = (body: string) => {
    const started = performance.now();
    compileArticleHtml(body, { baseUrl: BASE });
    return performance.now() - started;
  };

  test("thousands of code blocks in one container", () => {
    const body = `<div>${"<pre><code>x</code></pre>".repeat(6_000)}</div>`;

    expect(time(body)).toBeLessThan(3_000);
  });

  test("thousands of headings whose ids slug to the same anchor", () => {
    // Distinct ids made only of punctuation: every one slugs to the same base.
    const body = Array.from(
      { length: 20_000 },
      (_, index) => `<h2 id="a${index.toString(2).replace(/0/g, "!").replace(/1/g, "?")}">x</h2>`,
    ).join("");

    const started = performance.now();
    const html = compileArticleHtml(body, { baseUrl: BASE }).html;
    const elapsed = performance.now() - started;

    expect(elapsed).toBeLessThan(3_000);
    expect(new Set(html.match(/id="[^"]+"/g)).size).toBe(20_000);
  });

  test("a code block still finds its filename title bar", () => {
    const html = compileArticleHtml(
      `<div><div class="code-block-title">app.ts</div><pre><code>x</code></pre></div>`,
      { baseUrl: BASE },
    ).html;

    expect(html).toContain('data-kyomi-filename="app.ts"');
  });
});

describe("structure budget", () => {
  const compile = (body: string) => compileArticleHtml(body, { baseUrl: BASE }).html;

  test("a body nested tens of thousands deep compiles as its text instead of overflowing", () => {
    const started = performance.now();
    const html = compile(`${"<div>".repeat(22_000)}the readable text${"</div>".repeat(22_000)}`);
    const elapsed = performance.now() - started;

    expect(html).toBe("<p>the readable text</p>");
    expect(elapsed).toBeLessThan(1_000);
  });

  test("a body of far too many elements compiles as bounded text", () => {
    const started = performance.now();
    const html = compile("<span>word </span>".repeat(150_000));
    const elapsed = performance.now() - started;

    expect(html).not.toContain("<span");
    expect(html).toContain("word");
    expect(elapsed).toBeLessThan(2_000);
  });

  test("the text of a refused body is escaped, scripts are dropped, entities still read", () => {
    const html = compile(
      `${"<div>".repeat(300)}<script>alert(1)</script>a &amp; b &lt;i&gt; < c <img src=x onerror=alert(1)>`,
    );

    expect(html).not.toContain("alert(1)");
    expect(html).not.toContain("<img");
    expect(html).toContain("a &amp; b &lt;i&gt;");
  });

  test("the compiled document of a deeply nested body is still produced", async () => {
    const { document } = await compileArticleDocument({
      body: `${"<div>".repeat(22_000)}hello`,
      origin: "feed_html",
      baseUrl: BASE,
    });

    expect(JSON.stringify(document)).toContain("hello");
  });

  test("ordinary nesting, optional end tags and void elements are left alone", () => {
    const nested = `${"<div>".repeat(100)}deep${"</div>".repeat(100)}`;
    expect(compile(nested)).toContain("deep");
    expect(compile(nested)).toContain("<div>");

    // 3,000 items and rows whose end tags were left out do not nest.
    const optional = `<ul>${"<li>item".repeat(3_000)}</ul><table>${"<tr><td>cell".repeat(3_000)}</table>`;
    expect(compile(optional)).toContain("<li>item");
    expect(compile(optional)).toContain("<table");

    const voids = `<p>${"line<br>".repeat(5_000)}${'<img src="https://example.com/a.png">'.repeat(2_000)}</p>`;
    expect(compile(voids)).toContain("<br>");
    expect(compile(voids)).toContain("<img");
  });
});

describe("tokenizing time is bounded, not only characters", () => {
  /** The C# grammar takes about a second on one line of repeated `<a `, and stays there. */
  const hostileLine = "&lt;a ".repeat(32);
  const csharp = (lines: number) =>
    `<pre><code class="language-csharp">${Array.from({ length: lines }, () => hostileLine).join("\n")}</code></pre>`;

  test("a block of lines that make the grammar backtrack stops colouring and stays fast", async () => {
    const started = performance.now();
    const { document } = await compileArticleDocument({
      body: csharp(12),
      origin: "feed_html",
      baseUrl: BASE,
    });
    const elapsed = performance.now() - started;

    const [block] = codeBlocks(document as { blocks: Block[] } | null);
    expect(block).toBeDefined();
    expect(block?.highlight).toBeUndefined();
    // Twelve lines took fourteen seconds, a second each; now one line is paid for and no more.
    expect(elapsed).toBeLessThan(6_000);
  });

  test("the same bound holds across blocks, so many hostile blocks cost about one", async () => {
    const started = performance.now();
    await compileArticleDocument({
      body: Array.from({ length: 8 }, () => csharp(3)).join(""),
      origin: "feed_html",
      baseUrl: BASE,
    });

    expect(performance.now() - started).toBeLessThan(6_000);
  });

  test("a spent clock declines a block, an unspent one colours it without being charged", async () => {
    const value = Array.from({ length: 50 }, (_, line) => `const v${line} = ${line};`).join("\n");

    expect(await highlightCode(value, "javascript", { remainingMs: 0 })).toBeNull();
    const clock = { remainingMs: MAX_DOCUMENT_HIGHLIGHT_MS };
    expect(await highlightCode(value, "javascript", clock)).not.toBeNull();
    // Ordinary lines are never charged, so a busy machine cannot spend the budget on them.
    expect(clock.remainingMs).toBe(MAX_DOCUMENT_HIGHLIGHT_MS);
  });

  test("a large ordinary document is not charged, in any language", async () => {
    const clock = { remainingMs: MAX_DOCUMENT_HIGHLIGHT_MS };
    const css = Array.from(
      { length: 400 },
      (_, line) => `.card-${line} > a:hover { margin: ${line}px auto; color: #${line % 10}f0; }`,
    ).join("\n");
    const html = `<div class="a"><script>let x = 1;</script><style>a{b:c}</style></div>\n`.repeat(
      100,
    );

    expect(await highlightCode(css, "css", clock)).not.toBeNull();
    expect(await highlightCode(html, "html", clock)).not.toBeNull();

    expect(clock.remainingMs).toBe(MAX_DOCUMENT_HIGHLIGHT_MS);
  });

  test("tokenizing line by line gives the tokens of one pass, state included", async () => {
    // A block comment and a template literal each carry their state across lines.
    const value = "/* one\n two\n three */ const a = `x\n y\n z`;\nconst b = 2;";
    const highlight = await highlightCode(value, "javascript");

    expect(highlight).not.toBeNull();
    const styleOf = (text: string) =>
      highlight?.lines.flat().find(([content]) => content.includes(text))?.[1];
    expect(styleOf("two")).toBe(styleOf("/* one"));
    expect(styleOf("three")).toBe(styleOf("/* one"));
    expect(styleOf(" y")).toBe(styleOf("`x"));
    expect(styleOf("const")).not.toBe(styleOf("/* one"));
  });

  test("a block with a carriage return is still declined", async () => {
    expect(await highlightCode("const a = 1;\r\nconst b = 2;", "javascript")).toBeNull();
  });
});

describe("the code pass scales with blocks", () => {
  test("tens of thousands of fenced blocks are not compared with each other", async () => {
    const started = performance.now();
    const { document } = await compileArticleDocument({
      body: "```\n".repeat(60_000),
      format: "markdown",
      origin: "feed_markdown",
      baseUrl: BASE,
    });
    const elapsed = performance.now() - started;

    expect(document).not.toBeNull();
    // This took seven seconds, quadratic in the number of blocks.
    expect(elapsed).toBeLessThan(2_500);
  });

  test("only a bounded number of unhinted blocks go to the language model", async () => {
    const snippet = (index: number) =>
      `public async Task&lt;List&lt;Flag${index}&gt;&gt; GetFlagsAsync(string key)\n{\n    var cache = new Cache();\n    var flags = await cache.GetAsync(key);\n    return flags;\n}\n`;
    const { document } = await compileArticleDocument({
      body: Array.from(
        { length: 100 },
        (_, index) => `<pre><code>${snippet(index)}</code></pre>`,
      ).join(""),
      origin: "feed_html",
      baseUrl: BASE,
    });

    const blocks = codeBlocks(document as { blocks: Block[] } | null);
    expect(blocks).toHaveLength(100);
    const coloured = blocks.filter((block) => block.highlight).length;
    // The first ones are recognised, as they are one by one; the rest stay plain.
    expect(coloured).toBeGreaterThan(0);
    expect(coloured).toBeLessThanOrEqual(64);
  });
});

describe("raw HTML in Markdown", () => {
  const compile = (body: string) =>
    compileArticleDocument({ body, format: "markdown", origin: "feed_markdown", baseUrl: BASE });

  test.each([
    ["html blocks", "<div>a</div>\n\n".repeat(18_000)],
    ["inline html", "a <b>b</b> c\n\n".repeat(20_000)],
    ["unclosed blocks", "<div>\n\n".repeat(40_000)],
  ])("%s past the fragment budget build no document and stay fast", async (_name, body) => {
    const started = performance.now();
    const compiled = await compile(body);
    const elapsed = performance.now() - started;

    expect(compiled.document).toBeNull();
    expect(compiled.diagnostics.warnings).toContain("source-too-complex");
    expect(elapsed).toBeLessThan(3_000);
  });

  test("the sanitized HTML of such a body is still served", async () => {
    const compiled = await compile("<div>a</div>\n\n".repeat(18_000));

    expect(compiled.html).toContain("<div>a</div>");
  });

  test("fragments that are few and large are bounded by their size", async () => {
    const compiled = await compile(`<div>${"word ".repeat(2_000)}</div>\n\n`.repeat(100));

    expect(compiled.document).toBeNull();
    expect(compiled.diagnostics.warnings).toContain("source-too-complex");
  });

  test("an article with hundreds of fragments still gets its document", async () => {
    const body =
      '<p align="center"><img src="https://example.com/a.png"></p>\n\ntext **bold**\n\n'.repeat(
        200,
      );
    const compiled = await compile(body);

    expect(compiled.document).not.toBeNull();
    expect(compiled.diagnostics.warnings).not.toContain("source-too-complex");
    expect(JSON.stringify(compiled.document)).toContain("bold");
  });
});

describe("math delimiters", () => {
  const compile = (body: string) =>
    compileArticleDocument({ body, origin: "feed_html", baseUrl: BASE });
  const paragraphs = (text: string, count = 13) => `<p>${text}</p>`.repeat(count);

  test.each([
    ["unclosed \\[", "\\[".repeat(10_000)],
    ["unclosed \\(", "\\(".repeat(10_000)],
    ["a closed one, then unclosed \\[", `\\[x\\]${"\\[".repeat(9_997)}`],
    ["an empty one, then unclosed \\[", `\\[\\]${"\\[".repeat(9_998)}`],
    ["unclosed environments", "\\begin{equation}".repeat(1_200)],
    ["an environment closed by a lookalike", `${"\\begin{equation}".repeat(1_200)}\\end{equation`],
  ])("%s do not make the scan quadratic", async (_name, text) => {
    const started = performance.now();
    const { document } = await compile(paragraphs(text));
    const elapsed = performance.now() - started;

    expect(document).not.toBeNull();
    // Thirteen text nodes of twenty thousand characters took two to three seconds.
    expect(elapsed).toBeLessThan(1_200);
  });

  test("math is still found around openers nothing closes", async () => {
    const { document } = await compile(
      "<p>an unclosed \\[ here, then \\(x+1\\) and \\begin{align} a=b \\end{align} and $$y^2$$ done \\(</p>",
    );

    const text = JSON.stringify(document);
    expect(text).toContain('"tex":"x+1"');
    expect(text).toContain("y^2");
    expect(text).toContain("a=b");
  });

  test("ordinary delimiters render as before", async () => {
    const { document } = await compile(
      "<p>Let \\(x^2 + y^2 = z^2\\) and $a+b$; then \\[ \\int_0^1 x\\,dx = \\tfrac12 \\]</p>",
    );

    const text = JSON.stringify(document);
    expect(text).toContain("x^2 + y^2 = z^2");
    expect(text).toContain('"type":"math"');
  });
});
