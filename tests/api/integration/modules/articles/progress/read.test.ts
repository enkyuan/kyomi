import { describe, expect, test } from "bun:test";
import {
  attachReadingProgress,
  remainingMinutesFor,
  toReadingPositionDto,
  toReadingProgressDto,
} from "@modules/articles/progress/read";
import { toFeedArticleDetailDtoForTest } from "@modules/articles/read/detail";
import type { ArticleListRawRow } from "@modules/articles/read/list/dedupe";
import { toArticleListItemsForTest } from "@modules/articles/read/list/query";
import { articleDetailSchema, articleListItemSchema } from "@modules/articles/schemas";
import { clipToDetail } from "@modules/articles/write/clips/detail";
import { listClipsForUser } from "@modules/articles/write/clips/operations";
import { atMs, clipRow, createProgressDb, feedItemRow } from "./fakes";

const FEED_ITEM_ID = "00000000-0000-4000-8000-000000000001";
const CLIP_ID = "00000000-0000-4000-8000-0000000000c1";

const readingColumns = {
  readingProgress: 0.5,
  readingMaxProgress: 0.6,
  readingState: "reading",
  readingActiveReadMs: 25_000,
  readingContentWords: 1_000,
  readingLastReadAt: atMs(0),
  readingCompletedAt: null,
};

const positionColumns = {
  ...readingColumns,
  readingAnchor: null,
  readingContentKey: "feed_html:v1",
  readingClientUpdatedAt: atMs(-1_000),
};

function stateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "state-1",
    userId: "user-1",
    feedItemId: FEED_ITEM_ID,
    clipId: null,
    progress: 0.5,
    maxProgress: 0.6,
    state: "reading",
    activeReadMs: 25_000,
    contentWords: 1_000,
    lastReadAt: atMs(0),
    completedAt: null,
    ...overrides,
  };
}

function rawListRow(): ArticleListRawRow {
  return {
    id: FEED_ITEM_ID,
    title: "Title",
    canonicalUrl: "https://a.example.com/1",
    link: "https://a.example.com/1",
    summary: null,
    publishedAt: new Date("2026-07-01T00:00:00.000Z"),
    feedId: "feed-1",
    feedUrl: null,
    feedSiteUrl: null,
    feedTitle: "Alpha",
    feedFaviconUrl: null,
    isRead: false,
    isSaved: false,
    lastViewedAt: null,
    hiddenAt: null,
    categories: [],
  };
}

describe("remainingMinutesFor", () => {
  test("rounds up the words left at 238 words per minute", () => {
    expect(remainingMinutesFor(1_000, 0.5)).toBe(3);
    expect(remainingMinutesFor(238, 0)).toBe(1);
    expect(remainingMinutesFor(239, 0)).toBe(2);
  });

  test("is zero at the end and null when the word count is unknown", () => {
    expect(remainingMinutesFor(1_000, 1)).toBe(0);
    expect(remainingMinutesFor(null, 0.5)).toBeNull();
  });
});

describe("toReadingProgressDto", () => {
  test("maps the joined columns and derives engagement and time left", () => {
    expect(toReadingProgressDto(readingColumns)).toEqual({
      progress: 0.5,
      maxProgress: 0.6,
      state: "reading",
      engaged: true,
      remainingMinutes: 3,
      lastReadAt: atMs(0).toISOString(),
      completedAt: null,
    });
  });

  test("requires both progress and time to count as engaged", () => {
    expect(toReadingProgressDto({ ...readingColumns, readingActiveReadMs: 19_999 })?.engaged).toBe(
      false,
    );
    expect(toReadingProgressDto({ ...readingColumns, readingMaxProgress: 0.04 })?.engaged).toBe(
      false,
    );
  });

  test("is null when the left join found no row", () => {
    expect(
      toReadingProgressDto({
        readingProgress: null,
        readingMaxProgress: null,
        readingState: null,
        readingActiveReadMs: null,
        readingContentWords: null,
        readingLastReadAt: null,
        readingCompletedAt: null,
      }),
    ).toBeNull();
    expect(toReadingProgressDto({})).toBeNull();
  });
});

describe("toReadingPositionDto", () => {
  test("maps position, anchor and the last accepted client time", () => {
    const anchor = { kind: "block", blockIndex: 3, offset: 0.25, fingerprint: "abc" } as const;

    expect(toReadingPositionDto({ ...positionColumns, readingAnchor: anchor })).toEqual({
      progress: 0.5,
      anchor,
      contentKey: "feed_html:v1",
      updatedAt: atMs(-1_000).toISOString(),
    });
  });

  test("drops a malformed stored anchor and is null without a row", () => {
    expect(
      toReadingPositionDto({ ...positionColumns, readingAnchor: { kind: "x" } })?.anchor,
    ).toBeNull();
    expect(toReadingPositionDto({})).toBeNull();
  });
});

describe("article DTOs carry reading progress", () => {
  test("list and detail schemas declare the new fields", () => {
    expect(articleListItemSchema.properties).toHaveProperty("readingProgress");
    expect(articleDetailSchema.properties).toHaveProperty("readingProgress");
    expect(articleDetailSchema.properties).toHaveProperty("readingPosition");
  });

  test("a mapped list row has no progress until the page lookup attaches it", () => {
    const [item] = toArticleListItemsForTest([rawListRow()]);

    expect(item?.readingProgress).toBeNull();
  });

  test("the page lookup attaches this user's progress to feed items and clips", async () => {
    const db = createProgressDb({
      readingStates: [
        stateRow(),
        stateRow({ id: "state-2", feedItemId: null, clipId: CLIP_ID, progress: 0.9 }),
        stateRow({ id: "state-3", userId: "user-2", progress: 0.1 }),
      ],
    });
    const items = toArticleListItemsForTest([rawListRow()]);

    const [feed] = await attachReadingProgress(db as never, "user-1", items);
    const [clip] = await attachReadingProgress(db as never, "user-1", [
      { ...items[0]!, id: CLIP_ID, articleType: "clip" as const },
    ]);
    const [other] = await attachReadingProgress(db as never, "user-3", items);

    expect(feed?.readingProgress?.progress).toBe(0.5);
    expect(clip?.readingProgress?.progress).toBe(0.9);
    expect(other?.readingProgress).toBeNull();
  });

  test("an empty page never queries", async () => {
    const db = createProgressDb();
    const select = db.select;
    let selects = 0;
    db.select = (() => {
      selects += 1;
      return select();
    }) as typeof db.select;

    expect(await attachReadingProgress(db as never, "user-1", [])).toEqual([]);
    expect(selects).toBe(0);
  });

  test("the clip list returns each clip with its progress", async () => {
    const db = createProgressDb({
      clips: [clipRow()],
      readingStates: [stateRow({ feedItemId: null, clipId: CLIP_ID, progress: 0.3 })],
    });

    const page = await listClipsForUser(db as never, "user-1", { limit: 10 });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      id: CLIP_ID,
      articleType: "clip",
      readingProgress: { progress: 0.3, state: "reading" },
    });
  });

  test("feed detail carries progress and the restore position", () => {
    const detail = toFeedArticleDetailDtoForTest({
      ...feedItemRow(),
      ...positionColumns,
    } as never);

    expect(detail.readingProgress).toMatchObject({ progress: 0.5, engaged: true });
    expect(detail.readingPosition).toEqual({
      progress: 0.5,
      anchor: null,
      contentKey: "feed_html:v1",
      updatedAt: atMs(-1_000).toISOString(),
    });
  });

  test("feed detail has null progress and position when the user never read it", () => {
    const detail = toFeedArticleDetailDtoForTest(feedItemRow() as never);

    expect(detail.readingProgress).toBeNull();
    expect(detail.readingPosition).toBeNull();
  });

  test("clip detail carries progress and the restore position", () => {
    const detail = clipToDetail({ ...clipRow(), ...positionColumns } as never);

    expect(detail.articleType).toBe("clip");
    expect(detail.readingProgress).toMatchObject({ progress: 0.5 });
    expect(detail.readingPosition?.contentKey).toBe("feed_html:v1");
  });

  test("a freshly created clip has no progress", () => {
    const detail = clipToDetail(clipRow() as never);

    expect(detail.readingProgress).toBeNull();
    expect(detail.readingPosition).toBeNull();
  });
});
