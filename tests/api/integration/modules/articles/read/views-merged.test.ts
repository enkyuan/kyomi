import { describe, expect, test } from "bun:test";
import {
  mergeRecentlyViewedItemsSorted,
  type RecentlyViewedItem,
} from "@modules/articles/read/recent-view";

function item(overrides: Partial<RecentlyViewedItem>): RecentlyViewedItem {
  return {
    id: "a",
    title: "Title",
    link: "https://example.com/post",
    summary: null,
    publishedAt: "2026-01-01T00:00:00.000Z",
    feedId: "feed-1",
    feedUrl: "https://example.com/feed.xml",
    feedSiteUrl: "https://example.com",
    feedTitle: "Feed",
    feedFaviconUrl: null,
    isRead: false,
    isSaved: false,
    articleType: "feed",
    lastViewedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("recently viewed merged articles", () => {
  test("orders by last viewed time instead of published time", () => {
    const oldArticleViewedNow = item({
      id: "old",
      publishedAt: "2024-01-01T00:00:00.000Z",
      lastViewedAt: new Date("2026-06-01T12:00:00.000Z"),
    });
    const newerArticleViewedEarlier = item({
      id: "newer",
      publishedAt: "2026-05-01T00:00:00.000Z",
      lastViewedAt: new Date("2026-06-01T11:00:00.000Z"),
    });

    const sorted = mergeRecentlyViewedItemsSorted(
      [newerArticleViewedEarlier, oldArticleViewedNow],
      "newest",
    );

    expect(sorted.map((entry) => entry.id)).toEqual(["old", "newer"]);
  });

  test("supports oldest viewed order", () => {
    const firstViewed = item({
      id: "first",
      lastViewedAt: new Date("2026-06-01T10:00:00.000Z"),
    });
    const lastViewed = item({
      id: "last",
      lastViewedAt: new Date("2026-06-01T12:00:00.000Z"),
    });

    const sorted = mergeRecentlyViewedItemsSorted([lastViewed, firstViewed], "oldest");

    expect(sorted.map((entry) => entry.id)).toEqual(["first", "last"]);
  });
});
