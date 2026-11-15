import { describe, expect, test } from "bun:test";
import { runThrough } from "./document-helpers";

const figuresOf = async (html: string) => (await runThrough(html, "figures")).blocks;
const IMG = (name: string, alt = "") =>
  `<img src="/${name}.jpg" alt="${alt}" width="10" height="10">`;

describe("figures (pass 11)", () => {
  test("keeps a captioned figure and applies its placement", async () => {
    const [figure] = await figuresOf(
      `<figure class="alignfull">${IMG("a", "A")}<figcaption>Cap <b>one</b></figcaption></figure>`,
    );
    expect(figure).toMatchObject({
      type: "figure",
      placement: "full",
      caption: [
        { type: "text", value: "Cap " },
        { type: "format", format: "strong" },
      ],
    });
  });

  test("splits a credit out of a caption", async () => {
    const [figure] = await figuresOf(
      `<figure>${IMG("a")}<figcaption>A harbour at dawn <span class="photo-credit">Photo: Ada</span></figcaption></figure>`,
    );
    expect(figure).toMatchObject({
      caption: [{ type: "text", value: "A harbour at dawn " }],
      credit: [{ type: "text", value: "Photo: Ada" }],
    });
  });

  test("clears alt text that repeats the caption", async () => {
    const [figure] = await figuresOf(
      `<figure>${IMG("a", "A  Harbour at dawn")}<figcaption>a harbour at dawn</figcaption></figure>`,
    );
    expect(figure).toMatchObject({ image: { alt: "" } });
  });

  test("keeps alt text that differs from the caption", async () => {
    const [figure] = await figuresOf(
      `<figure>${IMG("a", "Boats")}<figcaption>A harbour</figcaption></figure>`,
    );
    expect(figure).toMatchObject({ image: { alt: "Boats" } });
  });

  test("pairs an image with an emphasized line below it as its caption", async () => {
    const blocks = await figuresOf(`<p>${IMG("a")}</p><p><em>The caption line</em></p><p>Body</p>`);
    expect(blocks.map((block) => block.type)).toEqual(["figure", "paragraph"]);
    expect(blocks[0]).toMatchObject({ caption: [{ type: "text", value: "The caption line" }] });
  });

  test("pairs a paragraph the source labelled as a caption, then a credit line", async () => {
    const blocks = await figuresOf(
      `<p>${IMG("a")}</p><p class="wp-caption-text">Caption</p><p class="photo-credit">Credit</p><p>Body</p>`,
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      caption: [{ type: "text", value: "Caption" }],
      credit: [{ type: "text", value: "Credit" }],
    });
  });

  test("an emphasized line starting with Photo is a credit, not a caption", async () => {
    const blocks = await figuresOf(
      `<figure>${IMG("a")}<figcaption>Cap</figcaption></figure><p><em>Photo: Someone</em></p>`,
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ credit: [{ type: "text", value: "Photo: Someone" }] });
  });

  test("does not take a long emphasized paragraph for a caption", async () => {
    const long = "word ".repeat(120);
    const blocks = await figuresOf(`<p>${IMG("a")}</p><p><em>${long}</em></p>`);
    expect(blocks.map((block) => block.type)).toEqual(["figure", "paragraph"]);
    expect(blocks[0]).not.toHaveProperty("caption");
  });

  test("groups hinted gallery images, keeping per-image and gallery captions", async () => {
    const [gallery] = await figuresOf(
      `<figure class="wp-block-gallery alignwide"><figure>${IMG("a")}<figcaption>One</figcaption></figure><figure>${IMG("b")}</figure><figcaption>Both</figcaption></figure>`,
    );
    expect(gallery).toMatchObject({
      type: "gallery",
      layout: "grid",
      placement: "wide",
      items: [{ caption: [{ type: "text", value: "One" }] }, {}],
      caption: [{ type: "text", value: "Both" }],
    });
  });

  test("groups sibling images in one paragraph into a gallery", async () => {
    const [gallery] = await figuresOf(`<p>${IMG("a")}${IMG("b")}${IMG("c")}</p>`);
    expect(gallery).toMatchObject({ type: "gallery", layout: "grid" });
    expect((gallery as { items: unknown[] }).items).toHaveLength(3);
  });

  test("does not merge separate image paragraphs", async () => {
    const blocks = await figuresOf(`<p>${IMG("a")}</p><p>${IMG("b")}</p>`);
    expect(blocks.map((block) => block.type)).toEqual(["figure", "figure"]);
  });

  test("uses the carousel layout when the source was a slider", async () => {
    const [gallery] = await figuresOf(`<div class="gallery slider">${IMG("a")}${IMG("b")}</div>`);
    expect(gallery).toMatchObject({ type: "gallery", layout: "carousel" });
  });

  test("builds mediaText from a media-text pair", async () => {
    const [block] = await figuresOf(
      `<div class="wp-block-media-text has-media-on-the-right"><figure>${IMG("a", "Team")}</figure><div><p>Text</p></div></div>`,
    );
    expect(block).toMatchObject({
      type: "mediaText",
      mediaPosition: "end",
      image: { alt: "Team" },
      children: [{ type: "paragraph" }],
    });
  });

  test("works inside nested containers", async () => {
    const [quote] = await figuresOf(
      `<blockquote><p>${IMG("a")}</p><p><em>Cap</em></p></blockquote>`,
    );
    expect(quote).toMatchObject({
      children: [{ type: "figure", caption: [{ type: "text", value: "Cap" }] }],
    });
  });
});
