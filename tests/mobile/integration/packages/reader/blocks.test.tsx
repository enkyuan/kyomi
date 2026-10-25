import { describe, expect, test } from "bun:test";
import { html } from "./render";
import {
  readerDocumentSchema,
  type ReaderBlock,
} from "../../../../../packages/reader/src/core/document";
import { blocksByType, footnoteFixture, makeDocument } from "./fixtures";

const native = await import("../../../../../packages/reader/src/native/document");

const opened: string[] = [];
const footnotes: string[] = [];
const theme = native.createReaderNativeTheme({
  scheme: "light",
  availableWidth: 350,
  inset: 20,
  fontSize: 17,
});
const host = {
  openUrl: (url: string) => void opened.push(url),
  openFootnote: (footnote: { id: string }) => void footnotes.push(footnote.id),
  renderImage: (props: {
    image: { src: string };
    aspectRatio: number;
    accessibilityLabel?: string;
  }) => (
    <img
      alt={props.accessibilityLabel}
      data-ratio={props.aspectRatio.toFixed(3)}
      src={props.image.src}
    />
  ),
  renderIsland: (props: { kind: string; title: string }) => (
    <iframe data-kind={props.kind} title={props.title} />
  ),
};

function render(block: ReaderBlock, overrides: Partial<typeof host> = {}) {
  const doc = readerDocumentSchema.parse(makeDocument([block], footnoteFixture));
  const footnoteMap = native.planDocument(doc).footnotes;
  return html(
    <native.ReaderNativeProvider
      value={{ theme, host: { ...host, ...overrides }, footnotes: footnoteMap }}
    >
      <native.BlockView block={doc.blocks[0]!} />
    </native.ReaderNativeProvider>,
  );
}

describe("fixtures", () => {
  test("every block type has a fixture the schema accepts", () => {
    const doc = readerDocumentSchema.parse(
      makeDocument(Object.values(blocksByType) as ReaderBlock[], footnoteFixture),
    );
    expect(new Set(doc.blocks.map((block) => block.type)).size).toBe(
      Object.keys(blocksByType).length,
    );
  });
});

describe("native block rendering", () => {
  test("paragraph renders nested inlines, selectable, with link and footnote roles", () => {
    const out = render(blocksByType.paragraph);
    expect(out).toContain("bold");
    expect(out).toContain('data-selectable="true"');
    expect(out).toContain('data-role="link"');
    expect(out).toContain("H₂O x²");
    expect(out).toContain("inline()");
    expect(out).toContain('data-label="Footnote 1"');
  });

  test("heading exposes the header role", () => {
    expect(render(blocksByType.heading)).toContain('data-role="header"');
  });

  test("ordered list honours start and task state", () => {
    const out = render(blocksByType.list);
    expect(out).toContain("3.");
    expect(out).toContain("☑");
    expect(out).toContain("☐");
    expect(out).toContain('data-label="Done"');
    expect(out).toContain('data-role="list"');
  });

  test("quote, pull quote, callout, details and definition list render their text", () => {
    expect(render(blocksByType.quote)).toContain("Someone");
    expect(render(blocksByType.pullQuote)).toContain("Pulled");
    const callout = render(blocksByType.callout);
    expect(callout).toContain("Heads up");
    expect(callout).toContain("Callout body");
    const details = render(blocksByType.details);
    expect(details).toContain("Hidden body");
    expect(details).toContain('data-expanded="true"');
    const definition = render(blocksByType.definitionList);
    expect(definition).toContain("Term");
    expect(definition).toContain("Definition");
  });

  test("divider is hidden from screen readers", () => {
    expect(render(blocksByType.divider)).toContain("no-hide-descendants");
  });

  test("code renders stored tokens without a highlighter", () => {
    const out = render(blocksByType.code);
    expect(out).toContain("a.ts");
    expect(out).toContain("const");
    expect(out).toContain('data-selectable="true"');
  });

  test("table renders header and multi-block cells", () => {
    const out = render(blocksByType.table);
    expect(out).toContain("Table caption");
    expect(out).toContain("Name");
    expect(out).toContain("cell one");
    expect(out).toContain("cell two");
  });

  test("figure reserves the stored aspect ratio and shows caption and credit", () => {
    const out = render(blocksByType.figure);
    expect(out).toContain('data-ratio="2.000"');
    expect(out).toContain("Figure caption");
    expect(out).toContain("Credit line");
  });

  test("an unmeasured image still reserves a ratio", () => {
    const out = render(blocksByType.gallery);
    expect(out).toContain('data-ratio="1.000"');
    expect(out).toContain("Gallery caption");
  });

  test("video and audio fall back to an external player button", () => {
    expect(render(blocksByType.video)).toContain('data-label="Play video"');
    expect(render(blocksByType.audio)).toContain("Episode 1");
  });

  test("embed with a snapshot renders a card; without island support it degrades to a link card", () => {
    const card = render(blocksByType.embed);
    expect(card).toContain("Snapshot post text");
    expect(card).toContain("Ada");
    const bare = render({ ...blocksByType.embed, snapshot: undefined });
    expect(bare).toContain("Bluesky");
    expect(bare).toContain('data-role="link"');
  });

  test("an unsnapshotted player waits for a tap before mounting its island", () => {
    const out = render({
      ...blocksByType.embed,
      provider: "youtube",
      snapshot: undefined,
      frameUrl: "https://www.youtube-nocookie.com/embed/x",
    });
    expect(out).toContain("Load YouTube player");
    expect(out).not.toContain("<iframe");
  });

  test("link card renders title, description and site", () => {
    const out = render(blocksByType.linkCard);
    expect(out).toContain("Card title");
    expect(out).toContain("Card description");
    expect(out).toContain("Example");
  });

  test("media-text renders the image beside blocks", () => {
    const out = render(blocksByType.mediaText);
    expect(out).toContain("Beside the picture");
    expect(out).toContain("side.jpg");
  });

  test("math and html use the island when the host provides one, else degrade", () => {
    expect(render(blocksByType.math)).toContain('data-kind="math"');
    expect(render(blocksByType.html)).toContain('data-kind="html"');
    expect(render(blocksByType.math, { renderIsland: undefined })).toContain("E=mc^2");
    expect(render(blocksByType.html, { renderIsland: undefined })).toBe("");
  });
});
