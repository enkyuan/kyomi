// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { readerDocumentSchema, type ReaderDocument } from "@kyomi/reader/document";
import { RenderDocument, RenderHtml } from "@kyomi/reader/web";
import { dataTablesKdm, wordpressGutenbergKdm } from "./corpus-kdm";

const corpusDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../../../../tests/api/fixtures/articles/corpus/html",
);
const BASE_URL = "https://blog.wp.example/2026/10/offline-sync/";

const clean = (value: string | null | undefined) =>
  (value ?? "")
    .replace(/[↩︎️]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** The reading-relevant skeleton of a rendered article, independent of wrapper markup. */
function skeleton(root: HTMLElement) {
  const copy = root.cloneNode(true) as HTMLElement;
  // Chrome that exists on only one path: heading anchors, code toolbars, copy buttons.
  copy
    .querySelectorAll("[data-reader-heading-anchor], .reader-code-chrome, .reader-code-copy-button")
    .forEach((el) => el.remove());

  const blockSelector =
    "h1, h2, h3, h4, h5, h6, p, li, figcaption, caption, th, td, pre code, cite, footer";
  const blocks = [...copy.querySelectorAll(blockSelector)].filter(
    (el) => !el.querySelector(blockSelector),
  );
  const texts = (selector: string) =>
    [...copy.querySelectorAll(selector)].map((el) => clean(el.textContent));
  const tally = (selector: string) => copy.querySelectorAll(selector).length;

  return {
    leafText: blocks.map((el) => clean(el.textContent)).filter(Boolean),
    headings: texts("h1, h2, h3, h4, h5, h6"),
    bold: texts("b, strong"),
    italic: texts("i, em"),
    strike: texts("s, del"),
    images: [...copy.querySelectorAll("img")].map((img) => ({
      src: img.getAttribute("src"),
      alt: img.getAttribute("alt"),
    })),
    code: texts("pre code"),
    footnoteRefs: texts("sup"),
    spans: [...copy.querySelectorAll("th, td")].map(
      (el) => `${el.getAttribute("rowspan") ?? 1}x${el.getAttribute("colspan") ?? 1}`,
    ),
    counts: {
      tables: tally("table"),
      captions: tally("caption"),
      figcaptions: tally("figcaption"),
      blockquotes: tally("blockquote"),
      pre: tally("pre"),
      listItems: tally("li"),
      headingCells: tally("th"),
    },
  };
}

async function viaHtml(file: string): Promise<HTMLElement> {
  const html = readFileSync(join(corpusDir, file), "utf8");
  const { container } = render(<RenderHtml baseUrl={BASE_URL} html={html} layoutMode="fidelity" />);
  const body = container.querySelector<HTMLElement>(".article-body")!;
  // Image frames and code blocks are applied by the post-paint enhancement passes.
  await waitFor(() => {
    expect(
      body.querySelectorAll("img").length === 0 || body.querySelector("[data-reader-img-frame]"),
    ).toBeTruthy();
    expect(
      body.querySelectorAll("pre").length === 0 || body.querySelector("[data-reader-code-block]"),
    ).toBeTruthy();
  });
  return body;
}

function viaDocument(document: ReaderDocument): HTMLElement {
  const { container } = render(<RenderDocument document={document} showLinkPreviews={false} />);
  return container.querySelector<HTMLElement>(".article-body")!;
}

describe("HTML and KDM paths render the same article", () => {
  test("the hand-written KDM matches the schema", () => {
    expect(readerDocumentSchema.safeParse(wordpressGutenbergKdm).success).toBe(true);
    expect(readerDocumentSchema.safeParse(dataTablesKdm).success).toBe(true);
  });

  test("wordpress-gutenberg: same text, order, marks, images, code and footnote", async () => {
    const html = skeleton(await viaHtml("wordpress-gutenberg.html"));
    const kdm = skeleton(viaDocument(wordpressGutenbergKdm));

    expect(kdm.leafText).toEqual(html.leafText);
    expect(kdm.headings).toEqual(html.headings);
    expect(kdm.bold).toEqual(html.bold);
    expect(kdm.italic).toEqual(html.italic);
    expect(kdm.strike).toEqual(html.strike);
    expect(kdm.images).toEqual(html.images);
    expect(kdm.code).toEqual(html.code);
    expect(kdm.footnoteRefs).toEqual(html.footnoteRefs);
    expect(kdm.counts).toEqual(html.counts);
  });

  test("data-tables: same cells, spans, captions and nested content", async () => {
    const html = skeleton(await viaHtml("data-tables.html"));
    const kdm = skeleton(viaDocument(dataTablesKdm));

    expect(kdm.leafText).toEqual(html.leafText);
    expect(kdm.spans).toEqual(html.spans);
    expect(kdm.images).toEqual(html.images);
    expect(kdm.counts).toEqual(html.counts);
  });

  test("both paths mount in the same reader root with the same layout mode", async () => {
    const html = await viaHtml("data-tables.html");
    const kdm = viaDocument(dataTablesKdm);
    expect(kdm.className).toBe(html.className);
    expect(kdm.getAttribute("data-reader-layout-mode")).toBe(
      html.getAttribute("data-reader-layout-mode"),
    );
  });
});
