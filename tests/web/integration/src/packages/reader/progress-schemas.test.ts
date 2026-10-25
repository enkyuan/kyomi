import { describe, expect, test } from "vitest";
import { createActiveTimer, createReadingSession } from "@kyomi/reader/core";
import {
  articleDetailSchema,
  articleListItemSchema,
  readingProgressUpdateBodySchema,
} from "@kyomi/reader/schemas/article";
import { userPreferencesSchema } from "@kyomi/reader/schemas";

const SESSION_ID = "6f1c1f0e-4f55-4c1a-8f0e-2d4e9b7a1c11";

describe("reading progress schemas", () => {
  const listItem = {
    id: "a1",
    title: "Example",
    link: "https://example.com/posts/1",
    summary: null,
    publishedAt: "2026-05-01T00:00:00.000Z",
    feedId: "f1",
    feedTitle: "Feed",
    isRead: false,
    isSaved: false,
    articleType: "feed",
  };

  test("older cached list items without reading fields still parse", () => {
    expect(articleListItemSchema.parse(listItem).readingProgress).toBeNull();
  });

  test("parses a list item with reading progress", () => {
    const readingProgress = {
      progress: 0.4,
      maxProgress: 0.5,
      state: "resurfacing",
      engaged: true,
      remainingMinutes: 6,
      lastReadAt: "2026-10-24T10:00:00.000Z",
      completedAt: null,
    };
    expect(articleListItemSchema.parse({ ...listItem, readingProgress }).readingProgress).toEqual(
      readingProgress,
    );
  });

  test("rejects an unknown reading state", () => {
    expect(
      articleListItemSchema.safeParse({
        ...listItem,
        readingProgress: {
          progress: 0,
          maxProgress: 0,
          state: "paused",
          engaged: false,
          remainingMinutes: null,
          lastReadAt: "2026-10-24T10:00:00.000Z",
          completedAt: null,
        },
      }).success,
    ).toBe(false);
  });

  test("detail schema defaults readingPosition to null", () => {
    expect(articleDetailSchema.shape.readingPosition.parse(undefined)).toBeNull();
    expect(
      articleDetailSchema.shape.readingPosition.parse({
        progress: 0.3,
        anchor: null,
        contentKey: "feed_html:none",
        updatedAt: "2026-10-24T10:00:00.000Z",
      }),
    ).toMatchObject({ progress: 0.3, anchor: null });
  });

  const body = {
    progress: 0.5,
    anchor: null,
    contentKey: "feed_html:none",
    sessionId: SESSION_ID,
    sessionActiveMs: 1_000,
    completed: false,
    clientUpdatedAt: "2026-10-24T10:00:00.000Z",
  };

  test("update body enforces the contract ranges", () => {
    const parse = (overrides: object) =>
      readingProgressUpdateBodySchema.safeParse({ ...body, ...overrides }).success;
    expect(parse({})).toBe(true);
    expect(parse({ progress: 1.01 })).toBe(false);
    expect(parse({ progress: -0.01 })).toBe(false);
    expect(parse({ contentKey: "k".repeat(129) })).toBe(false);
    expect(parse({ contentKey: "k".repeat(128) })).toBe(true);
    expect(parse({ sessionId: "not-a-uuid" })).toBe(false);
    expect(parse({ sessionActiveMs: -1 })).toBe(false);
    expect(parse({ sessionActiveMs: 1.5 })).toBe(false);
    expect(parse({ clientUpdatedAt: "yesterday" })).toBe(false);
  });

  test("block anchors enforce the contract ranges", () => {
    const anchor = { kind: "block", blockIndex: 12, offset: 0.5, fingerprint: "abc" };
    const parse = (value: object) =>
      readingProgressUpdateBodySchema.safeParse({ ...body, anchor: value }).success;
    expect(parse(anchor)).toBe(true);
    expect(parse({ ...anchor, blockIndex: 10_001 })).toBe(false);
    expect(parse({ ...anchor, blockIndex: -1 })).toBe(false);
    expect(parse({ ...anchor, blockIndex: 1.5 })).toBe(false);
    expect(parse({ ...anchor, offset: 1.1 })).toBe(false);
    expect(parse({ ...anchor, fingerprint: "f".repeat(33) })).toBe(false);
    expect(parse({ ...anchor, kind: "line" })).toBe(false);
  });

  test("a session body from createReadingSession parses", () => {
    const now = () => Date.parse("2026-10-24T10:00:00.000Z");
    const session = createReadingSession({
      contentKey: "feed_html:none",
      timer: createActiveTimer(now),
      now,
    });
    session.sample({ progress: 0.25 });
    expect(readingProgressUpdateBodySchema.safeParse(session.takeUpdate()).success).toBe(true);
  });

  test("preferences default rememberPosition to true and accept an explicit value", () => {
    const preferences = {
      defaultMode: "smart",
      fontSizePx: 17,
      contentWidth: "wide",
      openLinksInNewTab: true,
      showLinkPreviews: true,
      showImages: true,
      inboxDefaultView: "all",
      inboxDensity: "comfortable",
      articleOpenBehavior: "split",
      inboxMarkReadBehavior: "on-open",
      inboxTimestampDisplay: "relative",
      inboxTimestampHourCycle: "12h",
      inboxFontSizePx: 16,
      inboxShowFavicons: true,
    };
    expect(userPreferencesSchema.parse(preferences).rememberPosition).toBe(true);
    expect(
      userPreferencesSchema.parse({ ...preferences, rememberPosition: false }).rememberPosition,
    ).toBe(false);
  });
});
