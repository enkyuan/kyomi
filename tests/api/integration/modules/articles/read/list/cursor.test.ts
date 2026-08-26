import { describe, expect, test } from "bun:test";
import {
  decodeMergedListCursor,
  encodeMergedListCursorFromItem,
} from "@modules/articles/read/list/cursor";
import type { ArticleListItemDto } from "@modules/articles/types";

const sampleItem = (overrides: Partial<ArticleListItemDto> = {}): ArticleListItemDto => ({
  id: "clip_1",
  title: "t",
  link: "https://x",
  summary: null,
  publishedAt: "2024-06-01T12:00:00.000Z",
  feedId: "f1",
  feedUrl: "https://example.com/feed.xml",
  feedSiteUrl: "https://example.com",
  feedTitle: "F",
  feedFaviconUrl: null,
  isRead: false,
  isSaved: false,
  lastViewedAt: null,
  articleType: "clip",
  categories: [],
  ...overrides,
});

describe("merged list cursor codec", () => {
  test("decode allows undefined, empty, and whitespace", () => {
    expect(decodeMergedListCursor(undefined)).toBeUndefined();
    expect(decodeMergedListCursor("")).toBeUndefined();
    expect(decodeMergedListCursor("   ")).toBeUndefined();
  });

  test("round-trips boundary", () => {
    const item = sampleItem();
    const enc = encodeMergedListCursorFromItem(item, "latest");
    const dec = decodeMergedListCursor(enc);
    expect(dec?.publishedAt.toISOString()).toBe(item.publishedAt);
    expect(dec?.id).toBe(item.id);
  });

  test("decodes cursors issued with the legacy newest token", () => {
    const item = sampleItem();
    const legacyCursor = `m1.${Buffer.from(
      JSON.stringify({ v: 1, pa: item.publishedAt, id: item.id, s: "newest" }),
      "utf8",
    ).toString("base64url")}`;

    expect(decodeMergedListCursor(legacyCursor)?.id).toBe(item.id);
  });

  test("rejects unknown prefix", () => {
    expect(() => decodeMergedListCursor("nope")).toThrow();
  });

  test("rejects invalid json", () => {
    expect(() => decodeMergedListCursor("m1.xxx")).toThrow();
  });
});
