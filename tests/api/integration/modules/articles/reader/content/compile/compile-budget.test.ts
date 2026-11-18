import { describe, expect, test } from "bun:test";
import { compileArticleDocument, compileArticleHtml } from "@kyomi/ingest/document";

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
