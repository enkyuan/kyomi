import { describe, expect, test } from "bun:test";
import { runThrough } from "./document-helpers";

const run = (html: string) => runThrough(html, "footnotes");

describe("footnotes (pass 12)", () => {
  test("rewrites references to footnoteRef and assigns stable fn anchors", async () => {
    const draft = await run(
      `<p>One<sup><a id="r1" href="#n1">1</a></sup> two<sup><a id="r2" href="#n2">2</a></sup>.</p>
       <section class="footnotes"><ol><li id="n1">First <a href="#r1">↩︎</a></li><li id="n2">Second <a href="#r2">↩</a></li></ol></section>`,
    );
    expect(draft.blocks).toHaveLength(1);
    expect(draft.blocks[0]).toMatchObject({
      children: [
        { type: "text", value: "One" },
        { type: "footnoteRef", id: "fn-1", label: "1" },
        { type: "text", value: " two" },
        { type: "footnoteRef", id: "fn-2", label: "2" },
        { type: "text", value: "." },
      ],
    });
    expect(
      draft.footnotes.map((footnote) => [footnote.id, footnote.label, footnote.presentation]),
    ).toEqual([
      ["fn-1", "1", "footnote"],
      ["fn-2", "2", "footnote"],
    ]);
  });

  test("removes back-reference links from the definitions", async () => {
    const draft = await run(
      `<p>A<a id="r1" href="#n1">1</a></p><ol class="footnotes"><li id="n1">Body <a href="#r1">↩︎</a></li></ol>`,
    );
    expect(JSON.stringify(draft.footnotes[0]?.children)).not.toContain("↩");
    expect(draft.footnotes[0]?.children).toEqual([
      { type: "paragraph", children: [{ type: "text", value: "Body " }] },
    ]);
  });

  test("numbers footnotes by first reference, not by definition order", async () => {
    const draft = await run(
      `<p>B<a href="#b">x</a> A<a href="#a">y</a></p><ol class="footnotes"><li id="a">Alpha</li><li id="b">Beta</li></ol>`,
    );
    expect(draft.footnotes.map((footnote) => footnote.children[0])).toMatchObject([
      { children: [{ value: "Beta" }] },
      { children: [{ value: "Alpha" }] },
    ]);
  });

  test("keeps unreferenced definitions after the referenced ones", async () => {
    const draft = await run(
      `<p>A<a href="#a">1</a></p><ol class="footnotes"><li id="z">Orphan</li><li id="a">Used</li></ol>`,
    );
    expect(draft.footnotes.map((footnote) => footnote.id)).toEqual(["fn-1", "fn-2"]);
    expect(draft.footnotes[0]?.children[0]).toMatchObject({ children: [{ value: "Used" }] });
  });

  test("marks authored sidenotes", async () => {
    const draft = await run(
      `<p>Text<label for="x"></label><input id="x" type="checkbox"><span class="sidenote">Margin note</span>.</p>`,
    );
    expect(draft.footnotes).toHaveLength(1);
    expect(draft.footnotes[0]).toMatchObject({ presentation: "sidenote", label: "1" });
    expect(JSON.stringify(draft.blocks)).toContain('"footnoteRef"');
  });

  test("reads a Substack-style single footnote block", async () => {
    const draft = await run(
      `<p>Claim<a id="anchor-1" class="footnote-anchor" href="#footnote-1">1</a></p><div class="footnote"><a id="footnote-1" href="#anchor-1" class="footnote-number">1</a><div class="footnote-content"><p>The source.</p></div></div>`,
    );
    expect(draft.blocks).toHaveLength(1);
    expect(draft.footnotes).toHaveLength(1);
    expect(draft.footnotes[0]?.children).toEqual([
      { type: "paragraph", children: [{ type: "text", value: "The source." }] },
    ]);
  });

  test("resolves Markdown footnotes", async () => {
    const { compileArticleDocument } = await import("@kyomi/worker/document");
    const result = await compileArticleDocument({
      body: "Claim[^a].\n\n[^a]: The note.",
      format: "markdown",
      origin: "feed_markdown",
    });
    expect(result.document?.footnotes).toMatchObject([{ id: "fn-1", label: "1" }]);
    expect(result.document?.blocks[0]).toMatchObject({
      children: [{}, { type: "footnoteRef", id: "fn-1" }, {}],
    });
  });

  test("leaves ordinary in-page links alone", async () => {
    const draft = await run(`<h2 id="h">Head</h2><p><a href="#h">jump</a></p>`);
    expect(draft.footnotes).toEqual([]);
    expect(draft.blocks[1]).toMatchObject({ children: [{ type: "link", href: "#kyomi-h" }] });
  });
});
