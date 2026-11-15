import { describe, expect, test } from "bun:test";
import { runThrough } from "./document-helpers";

const run = (html: string, title?: string) =>
  runThrough(html, "normalize", { title: title ?? null });

describe("normalize (pass 16)", () => {
  test("merges adjacent text, collapses whitespace, and trims block edges", async () => {
    const draft = await run(`<p>  Hello   <b></b> world \n again  </p>`);
    expect(draft.blocks).toEqual([
      { type: "paragraph", children: [{ type: "text", value: "Hello world again" }] },
    ]);
  });

  test("drops spaces around line breaks", async () => {
    const draft = await run(`<p>one <br> two</p>`);
    expect(draft.blocks[0]).toMatchObject({
      children: [{ value: "one" }, { type: "break" }, { value: "two" }],
    });
  });

  test("drops empty paragraphs, lists, quotes, and containers emptied by their children", async () => {
    const draft = await run(
      `<p> </p><ul><li></li></ul><blockquote><p> </p></blockquote><div><div></div></div><p>Keep</p>`,
    );
    expect(draft.blocks).toHaveLength(1);
  });

  test("unwraps nested links, however deep", async () => {
    // The HTML parser never nests anchors, but Markdown inline HTML and later passes can.
    const draft = await run(`<p>x</p>`);
    draft.blocks.push({
      type: "paragraph",
      children: [
        {
          type: "link",
          href: "https://outer.example/",
          children: [
            { type: "text", value: "out " },
            {
              type: "format",
              format: "strong",
              children: [
                {
                  type: "link",
                  href: "https://inner.example/",
                  children: [{ type: "text", value: "in" }],
                },
              ],
            },
          ],
        },
      ],
    });
    const { ARTICLE_DOCUMENT_PASSES } = await import("@kyomi/worker/document");
    await ARTICLE_DOCUMENT_PASSES.find((pass) => pass.name === "normalize")!.run(draft);
    const json = JSON.stringify(draft.blocks[1]);
    expect(json.match(/"type":"link"/g)).toHaveLength(1);
    expect(json).toContain("outer.example");
    expect(json).toContain('"value":"in"');
  });

  test("unwraps links to anchors that do not exist", async () => {
    const draft = await run(
      `<h2 id="here">Here</h2><p><a href="#here">ok</a> <a href="#gone">dangling</a></p>`,
    );
    expect(draft.blocks[1]).toMatchObject({
      children: [
        { type: "link", href: "#kyomi-here" },
        { type: "text", value: " dangling" },
      ],
    });
  });

  test("removes a leading heading equal to the title, ignoring case and punctuation", async () => {
    const draft = await run(`<h1>The Title: Part 1!</h1><h2>Next</h2><p>x</p>`, "the title part 1");
    expect(draft.blocks.map((block) => block.type)).toEqual(["heading", "paragraph"]);
  });

  test("keeps a first heading that differs from the title or is not first", async () => {
    expect((await run(`<h1>Other</h1><p>x</p>`, "Title")).blocks).toHaveLength(2);
    expect((await run(`<p>x</p><h1>Title</h1>`, "Title")).blocks).toHaveLength(2);
  });

  test("shifts headings so the shallowest is level 2", async () => {
    const down = await run(`<h4>A</h4><h5>B</h5><h4>C</h4>`);
    expect(down.blocks.map((block) => (block as { level: number }).level)).toEqual([2, 3, 2]);
    const up = await run(`<h1>A</h1><h3>B</h3>`);
    expect(up.blocks.map((block) => (block as { level: number }).level)).toEqual([2, 4]);
  });

  test("clamps shifted headings at level 6", async () => {
    const draft = await run(`<h1>A</h1><h6>B</h6>`);
    expect(draft.blocks.map((block) => (block as { level: number }).level)).toEqual([2, 6]);
  });

  test("moves a duplicated hero image to meta.leadImage", async () => {
    const draft = await runThroughWithLead(
      `<figure><img src="https://cdn.example/photo-1024x576.jpg" alt="Hero" width="1024" height="576"></figure><p>Body</p>`,
      "https://cdn.example/photo.jpg",
    );
    expect(draft.blocks.map((block) => block.type)).toEqual(["paragraph"]);
    expect(draft.meta.leadImage).toMatchObject({
      src: "https://cdn.example/photo-1024x576.jpg",
      alt: "Hero",
    });
  });

  test("leaves a different first figure in the body", async () => {
    const draft = await runThroughWithLead(
      `<figure><img src="https://cdn.example/other.jpg" alt="" width="10" height="10"></figure><p>Body</p>`,
      "https://cdn.example/photo.jpg",
    );
    expect(draft.blocks.map((block) => block.type)).toEqual(["figure", "paragraph"]);
  });

  test("does not look for the hero image past the opening blocks", async () => {
    const draft = await runThroughWithLead(
      `<p>One</p><figure><img src="https://cdn.example/photo.jpg" alt="" width="10" height="10"></figure>`,
      "https://cdn.example/photo.jpg",
    );
    expect(draft.blocks).toHaveLength(2);
  });

  test("keeps only the first block that claims an anchor", async () => {
    const draft = await run(`<h2 id="a">One</h2><p>x</p>`);
    draft.blocks.push({
      type: "heading",
      level: 2,
      anchor: "kyomi-a",
      children: [{ type: "text", value: "Dup" }],
    });
    const { ARTICLE_DOCUMENT_PASSES } = await import("@kyomi/worker/document");
    await ARTICLE_DOCUMENT_PASSES.find((pass) => pass.name === "normalize")!.run(draft);
    expect(draft.blocks.filter((block) => block.anchor === "kyomi-a")).toHaveLength(1);
  });
});

async function runThroughWithLead(html: string, leadSrc: string) {
  const { ARTICLE_DOCUMENT_PASSES } = await import("@kyomi/worker/document");
  const { lowerToDraft } = await import("./document-helpers");
  const draft = lowerToDraft(html);
  draft.leadImage = { src: leadSrc, alt: "" };
  draft.meta.leadImage = draft.leadImage;
  await ARTICLE_DOCUMENT_PASSES.find((pass) => pass.name === "normalize")!.run(draft);
  return draft;
}
