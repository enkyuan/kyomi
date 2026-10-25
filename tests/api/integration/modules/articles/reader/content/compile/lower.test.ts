import { describe, expect, test } from "bun:test";
import {
  createLowerContext,
  lowerHtml,
  lowerMarkdown,
  lowerPlainText,
  compileArticleRoot,
} from "@kyomi/worker/document";
import { lowerToDraft } from "./document-helpers";

const blocksOf = (html: string) => lowerToDraft(html).blocks;
const text = (value: string) => ({ type: "text" as const, value });

describe("lower (pass 10): HTML", () => {
  test("lowers paragraphs with nested inline formatting, links, code, and breaks", () => {
    const [block] = blocksOf(
      `<p>A <b>bold <i>both</i></b> <a href="/x" title="T">link</a> <code>c()</code> <abbr title="Hypertext">HTML</abbr><br>next <kbd>K</kbd> <mark>m</mark> <sub>2</sub><sup>3</sup> <q>q</q></p>`,
    );
    expect(block).toEqual({
      type: "paragraph",
      children: [
        text("A "),
        {
          type: "format",
          format: "strong",
          children: [
            text("bold "),
            { type: "format", format: "emphasis", children: [text("both")] },
          ],
        },
        text(" "),
        { type: "link", href: "https://example.com/x", title: "T", children: [text("link")] },
        text(" "),
        { type: "code", value: "c()" },
        text(" "),
        { type: "abbr", title: "Hypertext", children: [text("HTML")] },
        { type: "break" },
        text("next "),
        { type: "format", format: "keyboard", children: [text("K")] },
        text(" "),
        { type: "format", format: "highlight", children: [text("m")] },
        text(" "),
        { type: "format", format: "subscript", children: [text("2")] },
        { type: "format", format: "superscript", children: [text("3")] },
        text(" "),
        { type: "format", format: "quote", children: [text("q")] },
      ],
    });
  });

  test("unwraps structural wrappers and groups loose inline runs into paragraphs", () => {
    const blocks = blocksOf(
      `<div><section><div>Loose <b>text</b><p>Para</p>tail</div></section></div>`,
    );
    expect(blocks.map((block) => block.type)).toEqual(["paragraph", "paragraph", "paragraph"]);
  });

  test("keeps heading levels as written and hoists ids to block anchors", () => {
    const [heading, paragraph] = blocksOf(
      `<h3 id="intro">Intro</h3><p>See <span id="mark">here</span></p>`,
    );
    expect(heading).toMatchObject({ type: "heading", level: 3, anchor: "kyomi-intro" });
    expect(paragraph).toMatchObject({ type: "paragraph", anchor: "kyomi-mark" });
  });

  test("lowers ordered, unordered, nested, and task lists", () => {
    const [ordered, tasks] = blocksOf(
      `<ol start="3"><li>One<ul><li>Nested</li></ul></li></ol><ul><li><input type="checkbox" checked> Done</li><li><input type="checkbox"> Todo</li></ul>`,
    );
    expect(ordered).toMatchObject({ type: "list", ordered: true, start: 3 });
    const first = (ordered as { items: { children: { type: string }[] }[] }).items[0]!;
    expect(first.children.map((child) => child.type)).toEqual(["paragraph", "list"]);
    expect(tasks).toMatchObject({
      type: "list",
      ordered: false,
      items: [{ checked: true }, { checked: false }],
    });
  });

  test("lowers a blockquote with attribution into a quote", () => {
    const [quote] = blocksOf(
      `<blockquote><p>Words</p><footer>— Someone, <cite>Book</cite></footer></blockquote>`,
    );
    expect(quote).toEqual({
      type: "quote",
      attribution: [
        text("Someone, "),
        { type: "format", format: "cite", children: [text("Book")] },
      ],
      children: [{ type: "paragraph", children: [text("Words")] }],
    });
  });

  test("turns GitHub alert syntax in a blockquote into a callout", () => {
    const [callout] = blocksOf(`<blockquote><p>[!WARNING] Careful</p></blockquote>`);
    expect(callout).toEqual({
      type: "callout",
      variant: "warning",
      children: [{ type: "paragraph", children: [text("Careful")] }],
    });
  });

  test("lowers tables with captions, header inference, spans, alignment, and block cells", () => {
    const [table] = blocksOf(
      `<table><caption>Cap</caption><tr><th>H1</th><th>H2</th></tr><tr><td colspan="2" align="right"><ul><li>x</li></ul></td></tr><tfoot><tr><td>F</td></tr></tfoot></table>`,
    );
    expect(table).toMatchObject({
      type: "table",
      caption: [text("Cap")],
      head: [[{ header: true }, { header: true }]],
      body: [[{ header: false, colSpan: 2, align: "end", children: [{ type: "list" }] }]],
      foot: [[{ header: false }]],
    });
  });

  test("lowers details, definition lists, and dividers", () => {
    const blocks = blocksOf(
      `<details open><summary>More</summary><p>Body</p></details><dl><dt>A</dt><dt>B</dt><dd>One</dd><dt>C</dt><dd>Two</dd></dl><hr>`,
    );
    expect(blocks[0]).toMatchObject({ type: "details", open: true, summary: [text("More")] });
    expect(blocks[1]).toMatchObject({
      type: "definitionList",
      items: [
        { terms: [[text("A")], [text("B")]], definitions: [[{ type: "paragraph" }]] },
        { terms: [[text("C")]], definitions: [[{ type: "paragraph" }]] },
      ],
    });
    expect(blocks[2]).toEqual({ type: "divider" });
  });

  test("lowers pre to a code block, keeping br as newlines and the captured hints", () => {
    const [code] =
      blocksOf(`<pre data-lang="ts" data-filename="a.ts" data-line="2-3"><code>a<br>b<span>c</span>
d
</code></pre>`);
    expect(code).toMatchObject({
      type: "code",
      value: "a\nbc\nd",
      filename: "a.ts",
      highlightLines: [2, 3],
      language: null,
      languageSource: "none",
    });
  });

  test("lowers images, linked images, and picture elements into figures", () => {
    const blocks = blocksOf(
      `<p><img src="/a.jpg" alt="A" width="10" height="5"></p><p><a href="/page"><img src="/b.jpg" alt="B"></a></p><picture><source srcset="/c.webp 1x"><img src="/c.jpg" alt="C"></picture>`,
    );
    expect(blocks.map((block) => block.type)).toEqual(["figure", "figure", "figure"]);
    expect(blocks[0]).toMatchObject({
      image: { src: "https://example.com/a.jpg", width: 10, height: 5 },
    });
    expect(blocks[1]).toMatchObject({ image: { href: "https://example.com/page" } });
  });

  test("keeps an inline image inside running text as an image inline", () => {
    const [paragraph] = blocksOf(`<p>Icon <img src="/e.png" alt="e"> inline</p>`);
    expect(paragraph).toMatchObject({
      type: "paragraph",
      children: [text("Icon "), { type: "image" }, text(" inline")],
    });
  });

  test("lowers video and audio with sources, poster, and size", () => {
    const [video, audio] = blocksOf(
      `<video poster="/p.jpg" width="640" height="360"><source src="/v.mp4" type="video/mp4"></video><audio src="/a.mp3"></audio>`,
    );
    expect(video).toMatchObject({
      type: "video",
      sources: [{ url: "https://example.com/v.mp4", mimeType: "video/mp4" }],
      poster: "https://example.com/p.jpg",
      width: 640,
      height: 360,
    });
    expect(audio).toMatchObject({ type: "audio", sources: [{ url: "https://example.com/a.mp3" }] });
  });

  test("lowers publisher MathML and prerendered KaTeX to math with TeX when available", () => {
    const blocks = blocksOf(
      `<p><math><semantics><mi>x</mi><annotation encoding="application/x-tex">x^2</annotation></semantics></math></p>
       <p><math><mi>y</mi></math></p>
       <p><span class="katex"><span class="katex-mathml"><math><semantics><mi>z</mi><annotation encoding="application/x-tex">z_1</annotation></semantics></math></span><span class="katex-html" aria-hidden="true">z1</span></span></p>`,
    );
    expect(blocks[0]).toMatchObject({ children: [{ type: "math", tex: "x^2" }] });
    expect(blocks[1]).toMatchObject({
      children: [{ type: "math", mathml: expect.stringContaining("<mi>y</mi>") }],
    });
    expect(blocks[2]).toMatchObject({ children: [{ type: "math", tex: "z_1" }] });
  });

  test("lowers a one-row equation layout table to a display math block", () => {
    const [equation, table] = blocksOf(
      `<table id="E1"><tbody><tr><td></td><td><math display="block"><semantics><mi>x</mi><annotation encoding="application/x-tex">x^2</annotation></semantics></math></td><td></td><td><span>(1)</span></td></tr></tbody></table>
       <table><tbody><tr><td>Word</td><td><math><mi>y</mi></math></td></tr></tbody></table>`,
    );
    expect(equation).toEqual({ type: "math", anchor: "kyomi-e1", tex: "x^2" });
    expect(table?.type).toBe("table");
  });

  test("wraps content past the depth cap in an html block with a reason", () => {
    const deep = `${"<div>".repeat(60)}<p>Deep</p>${"</div>".repeat(60)}`;
    const blocks = blocksOf(deep);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: "html", reason: "max-depth" });
  });

  test("honours placement hints on figures", () => {
    const [figure] = blocksOf(`<figure class="alignwide"><img src="/a.jpg" alt=""></figure>`);
    expect(figure).toMatchObject({ type: "figure", placement: "wide" });
  });

  test("lowers callouts with a title and plain pullquotes", () => {
    const blocks = blocksOf(
      `<div class="admonition tip"><p class="admonition-title">Pro tip</p><p>Body</p></div><figure class="wp-block-pullquote"><blockquote><p>Bold claim</p><cite>Me</cite></blockquote></figure>`,
    );
    expect(blocks[0]).toMatchObject({
      type: "callout",
      variant: "tip",
      title: [text("Pro tip")],
      children: [{ type: "paragraph", children: [text("Body")] }],
    });
    expect(blocks[1]).toEqual({
      type: "pullQuote",
      children: [text("Bold claim")],
      attribution: [text("Me")],
    });
  });
});

describe("lower (pass 10): Markdown", () => {
  const lower = (markdown: string) => {
    const ctx = createLowerContext();
    const blocks = lowerMarkdown(markdown, {
      ctx,
      baseUrl: "https://example.com/post/",
      sanitizeFragment: (html) =>
        compileArticleRoot(html, { baseUrl: "https://example.com/post/" }).root,
    });
    return { blocks, ctx };
  };

  test("lowers headings, lists, tasks, code, tables, and quotes from the TanStack AST", () => {
    const { blocks } = lower(
      '# Title\n\n- [x] done\n- [ ] todo\n\n```ts title="a.ts" {1,3}\nconst a = 1;\n```\n\n| a | b |\n|:--|--:|\n| 1 | 2 |\n\n> quote\n\n---',
    );
    expect(blocks.map((block) => block.type)).toEqual([
      "heading",
      "list",
      "code",
      "table",
      "quote",
      "divider",
    ]);
    expect(blocks[0]).toMatchObject({ anchor: "kyomi-title", level: 1 });
    expect(blocks[1]).toMatchObject({ items: [{ checked: true }, { checked: false }] });
    expect(blocks[2]).toMatchObject({
      value: "const a = 1;",
      filename: "a.ts",
      highlightLines: [1, 3],
    });
    expect(blocks[3]).toMatchObject({
      head: [
        [
          { header: true, align: "start" },
          { header: true, align: "end" },
        ],
      ],
      body: [[{ header: false }, { header: false }]],
    });
  });

  test("resolves relative links and images against the base URL", () => {
    const { blocks } = lower("[a](/docs) ![i](pic.png)");
    expect(blocks[0]).toMatchObject({
      children: [
        { type: "link", href: "https://example.com/docs" },
        { type: "text", value: " " },
        { type: "image", image: { src: "https://example.com/post/pic.png", alt: "i" } },
      ],
    });
  });

  test("routes inline HTML through the HTML passes", () => {
    const { blocks } = lower("Press <kbd>Ctrl</kbd> and <script>alert(1)</script>**go**");
    expect(blocks[0]).toMatchObject({
      children: [
        { type: "text", value: "Press " },
        { type: "format", format: "keyboard" },
        { type: "text", value: " and " },
        { type: "format", format: "strong" },
      ],
    });
    expect(JSON.stringify(blocks)).not.toContain("alert");
  });

  test("routes HTML blocks through the HTML passes and sanitizes them", () => {
    const { blocks } = lower(
      `<div onclick="x()"><p>Raw <b>html</b></p></div>\n\n<iframe src="https://evil.example/"></iframe>`,
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: "paragraph" });
  });

  test("collects footnote definitions and links references to them", () => {
    const { blocks, ctx } = lower("Claim[^a].\n\n[^a]: The *note*.");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      children: [text("Claim"), { type: "link", href: "#kyomi-fn-a" }, text(".")],
    });
    expect(ctx.defs).toEqual([
      {
        anchors: ["kyomi-fn-a"],
        presentation: "footnote",
        children: [
          {
            type: "paragraph",
            children: [
              text("The "),
              { type: "format", format: "emphasis", children: [text("note")] },
              text("."),
            ],
          },
        ],
      },
    ]);
  });

  test("keeps escaped math delimiters for the math pass", () => {
    const { blocks } = lower(String.raw`Inline \(x^2\) and \[y\]`);
    expect(JSON.stringify(blocks)).toContain(String.raw`\\(x^2\\)`);
  });

  test("turns GitHub alert quotes into callouts", () => {
    const { blocks } = lower("> [!NOTE]\n> Remember");
    expect(blocks[0]).toMatchObject({ type: "callout", variant: "note" });
  });
});

describe("lower (pass 10): plain text", () => {
  test("splits paragraphs on blank lines and keeps single newlines as breaks", () => {
    expect(lowerPlainText("One\nline two\r\n\r\n\r\nThree")).toEqual([
      { type: "paragraph", children: [text("One"), { type: "break" }, text("line two")] },
      { type: "paragraph", children: [text("Three")] },
    ]);
  });
});

describe("lower: unsupported content", () => {
  test("html blocks are the only escape hatch and carry a reason", () => {
    const { root } = compileArticleRoot(`<p>Plain</p>`, { baseUrl: null });
    const blocks = lowerHtml(root, createLowerContext());
    expect(blocks.filter((block) => block.type === "html")).toEqual([]);
  });
});
