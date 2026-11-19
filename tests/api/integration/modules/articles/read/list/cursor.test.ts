import { describe, expect, test } from "bun:test";
import { Effect, Exit } from "effect";
import {
  decodeCompositeCursor,
  decodeMergedListCursor,
  decodeRecentViewCursor,
  encodeCompositeCursor,
  encodeMergedListCursorFromItem,
  encodeRecentViewCursor,
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
  readingProgress: null,
  ...overrides,
});

const encodeRaw = (prefix: string, payload: unknown) =>
  `${prefix}${Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")}`;

describe("merged list cursor codec", () => {
  test("decode allows undefined, empty, and whitespace", async () => {
    for (const cursor of [undefined, "", "   "]) {
      expect(await Effect.runPromise(decodeMergedListCursor(cursor))).toBeUndefined();
    }
  });

  test("round-trips boundary", async () => {
    const item = sampleItem();
    const decoded = await Effect.runPromise(
      decodeMergedListCursor(encodeMergedListCursorFromItem(item, "latest")),
    );
    expect(decoded?.publishedAt.toISOString()).toBe(item.publishedAt);
    expect(decoded?.id).toBe(item.id);
    expect(decoded?.isRead).toBe(false);
  });

  test("decodes cursors issued with the legacy newest token", async () => {
    const item = sampleItem();
    const legacy = encodeRaw("m1.", { v: 1, pa: item.publishedAt, id: item.id, s: "newest" });

    expect((await Effect.runPromise(decodeMergedListCursor(legacy)))?.id).toBe(item.id);
  });

  test.each([
    ["an unknown prefix", "nope"],
    ["invalid json", "m1.xxx"],
    ["a wrong version", encodeRaw("m1.", { v: 2, pa: "2024-06-01T12:00:00.000Z", id: "a" })],
    ["a missing instant", encodeRaw("m1.", { v: 1, id: "a" })],
    ["an unparseable instant", encodeRaw("m1.", { v: 1, pa: "yesterday", id: "a" })],
    ["a blank id", encodeRaw("m1.", { v: 1, pa: "2024-06-01T12:00:00.000Z", id: "  " })],
    ["a non-object payload", encodeRaw("m1.", null)],
  ])("rejects %s with BadRequest MERGED_VIEW_CURSOR_INVALID", async (_label, cursor) => {
    const failure = await Effect.runPromise(Effect.flip(decodeMergedListCursor(cursor)));
    expect(failure).toMatchObject({
      _tag: "BadRequest",
      message: "Invalid merged view cursor.",
      code: "MERGED_VIEW_CURSOR_INVALID",
    });
  });
});

describe("recent view cursor codec", () => {
  test("round-trips boundary with read state", async () => {
    const lastViewedAt = new Date("2024-06-02T08:00:00.000Z");
    const cursor = encodeRecentViewCursor({ lastViewedAt, id: "a", isRead: true }, "oldest");

    expect(await Effect.runPromise(decodeRecentViewCursor(cursor))).toEqual({
      lastViewedAt,
      id: "a",
      isRead: true,
    });
  });

  test("decode allows an absent cursor", async () => {
    expect(await Effect.runPromise(decodeRecentViewCursor(undefined))).toBeUndefined();
    expect(await Effect.runPromise(decodeRecentViewCursor("  "))).toBeUndefined();
  });

  test.each([
    ["a merged cursor", encodeRaw("m1.", { v: 1, pa: "2024-06-01T12:00:00.000Z", id: "a" })],
    ["a bad instant", encodeRaw("rv1.", { v: 1, va: "nope", id: "a" })],
    ["a missing id", encodeRaw("rv1.", { v: 1, va: "2024-06-01T12:00:00.000Z" })],
  ])("rejects %s with BadRequest RECENT_VIEW_CURSOR_INVALID", async (_label, cursor) => {
    const exit = await Effect.runPromiseExit(decodeRecentViewCursor(cursor));
    expect(Exit.isFailure(exit)).toBe(true);
    const failure = await Effect.runPromise(Effect.flip(decodeRecentViewCursor(cursor)));
    expect(failure).toMatchObject({ _tag: "BadRequest", code: "RECENT_VIEW_CURSOR_INVALID" });
  });
});

describe("composite cursor codec", () => {
  test("round-trips a row boundary", () => {
    const publishedAt = new Date("2024-06-01T12:00:00.000Z");
    const cursor = encodeCompositeCursor({ publishedAt, id: "item_1", isRead: false }, "latest");

    expect(decodeCompositeCursor(cursor)).toEqual({ publishedAt, id: "item_1", isRead: false });
  });

  test("decodes the older iso::id form", () => {
    expect(decodeCompositeCursor("2024-06-01T12:00:00.000Z::item_1")).toEqual({
      publishedAt: new Date("2024-06-01T12:00:00.000Z"),
      id: "item_1",
    });
  });

  test("returns null for a bare article id so the caller can look it up", () => {
    expect(decodeCompositeCursor("item_1")).toBeNull();
  });

  test("returns null for a malformed a1 payload instead of failing", () => {
    expect(decodeCompositeCursor("a1.xxx")).toBeNull();
    expect(decodeCompositeCursor(encodeRaw("a1.", { pa: "nope", id: "a" }))).toBeNull();
    expect(decodeCompositeCursor(encodeRaw("a1.", { pa: "2024-06-01T12:00:00.000Z" }))).toBeNull();
  });
});
