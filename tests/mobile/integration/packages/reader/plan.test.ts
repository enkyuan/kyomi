import { describe, expect, test } from "bun:test";
import {
  readerDocumentSchema,
  type ReaderBlock,
} from "../../../../../packages/reader/src/core/document";
import {
  MAX_PROSE_RUN_BLOCKS,
  planDocument,
} from "../../../../../packages/reader/src/native/document/plan";
import {
  isSupportedDocumentVersion,
  NATIVE_DOCUMENT_VERSION,
} from "../../../../../packages/reader/src/native/document/support";
import {
  inlinesToText,
  safeExternalUrl,
  shiftScript,
} from "../../../../../packages/reader/src/native/document/text";
import { createReaderNativeTheme } from "../../../../../packages/reader/src/native/document/theme";
import { blocksByType, footnoteFixture, longDocument, makeDocument } from "./fixtures";

const p = (value: string): ReaderBlock => ({
  type: "paragraph",
  children: [{ type: "text", value }],
});

describe("planDocument", () => {
  test("merges consecutive paragraphs and breaks at headings and media", () => {
    const doc = readerDocumentSchema.parse(
      makeDocument([
        p("a"),
        p("b"),
        blocksByType.heading,
        p("c"),
        blocksByType.figure,
        p("d"),
      ] as ReaderBlock[]),
    );
    const plan = planDocument(doc);
    expect(
      plan.segments.map((s) => (s.kind === "prose" ? `prose:${s.blocks.length}` : s.block.type)),
    ).toEqual(["prose:2", "heading", "prose:1", "figure", "prose:1"]);
    expect(plan.anchorIndex.intro).toBe(1);
  });

  test("caps a run so long articles keep virtualizing", () => {
    const doc = readerDocumentSchema.parse(longDocument(400));
    const plan = planDocument(doc);
    const runs = plan.segments.filter((s) => s.kind === "prose");
    expect(runs.length).toBeGreaterThan(400 / MAX_PROSE_RUN_BLOCKS);
    expect(runs.every((s) => s.kind === "prose" && s.blocks.length <= MAX_PROSE_RUN_BLOCKS)).toBe(
      true,
    );
    const total = runs.reduce((n, s) => n + (s.kind === "prose" ? s.blocks.length : 0), 0);
    expect(total).toBe(400);
  });

  test("indexes anchors of nested blocks and keys footnotes by id", () => {
    const nested: ReaderBlock = {
      type: "quote",
      children: [{ ...blocksByType.heading, anchor: "deep" }],
    };
    const doc = readerDocumentSchema.parse(makeDocument([p("x"), nested], footnoteFixture));
    const plan = planDocument(doc);
    expect(plan.anchorIndex.deep).toBe(1);
    expect(plan.footnotes["fn-1"]?.label).toBe("1");
  });
});

describe("helpers", () => {
  test("version gate", () => {
    expect(isSupportedDocumentVersion(NATIVE_DOCUMENT_VERSION)).toBe(true);
    expect(isSupportedDocumentVersion(NATIVE_DOCUMENT_VERSION + 1)).toBe(false);
    expect(isSupportedDocumentVersion("1")).toBe(false);
  });

  test("only http, https and mailto links are opened", () => {
    expect(safeExternalUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("file:///etc/passwd")).toBeNull();
    expect(safeExternalUrl("not a url")).toBeNull();
  });

  test("sub and superscripts map to unicode only when every glyph exists", () => {
    expect(shiftScript("12", "super")).toBe("¹²");
    expect(shiftScript("2", "sub")).toBe("₂");
    expect(shiftScript("abc", "sub")).toBeNull();
  });

  test("inlinesToText flattens nested inlines", () => {
    const doc = readerDocumentSchema.parse(
      makeDocument([blocksByType.paragraph as ReaderBlock], footnoteFixture),
    );
    const block = doc.blocks[0]!;
    expect(block.type === "paragraph" && inlinesToText(block.children)).toContain(
      "Plain bold and italic",
    );
  });

  test("theme clamps the column to the content-width preference", () => {
    const narrow = createReaderNativeTheme({
      scheme: "light",
      availableWidth: 1000,
      inset: 20,
      fontSize: 17,
    });
    const wide = createReaderNativeTheme({
      scheme: "dark",
      availableWidth: 1000,
      inset: 20,
      fontSize: 17,
      contentWidth: "wide",
    });
    expect(narrow.columnWidth).toBe(704);
    expect(wide.columnWidth).toBe(960);
    expect(wide.colors.background).toBe("#202020");
  });
});
