import { describe, expect, test } from "bun:test";
import { toFeedArticleDetailDtoForTest } from "@modules/articles/read/detail";

type FeedArticleDetailRawRow = Parameters<typeof toFeedArticleDetailDtoForTest>[0];

function rawDetailRow(overrides: Partial<FeedArticleDetailRawRow> = {}): FeedArticleDetailRawRow {
  return {
    id: "item-1",
    title: "SearXNG: A free internet metasearch engine",
    link: "https://searxng.org/",
    summary: "Summary",
    imageUrl: "https://searxng.org/og-image.png",
    content: null,
    contentHtml: "<p>Summary</p>",
    contentText: "Summary",
    contentMarkdown: null,
    contentStatus: "ready",
    contentSource: "feed_html",
    extractionErrorCode: null,
    extractionErrorMessage: null,
    extractedContentHtml: null,
    extractedContentText: null,
    extractedContentStatus: "pending",
    extractedContentError: null,
    extractedContentUpdatedAt: null,
    publishedAt: new Date("2026-07-04T00:00:00.000Z"),
    feedId: "feed-1",
    feedUrl: "https://news.ycombinator.com/rss",
    feedSiteUrl: "https://news.ycombinator.com",
    feedTitle: "Hacker News",
    feedFaviconUrl: null,
    isRead: false,
    isSaved: false,
    categories: [],
    ...overrides,
  };
}

describe("article detail categories", () => {
  test("preserves the feed-provided lead image for reader clients", () => {
    const item = toFeedArticleDetailDtoForTest(
      rawDetailRow({ imageUrl: "https://searxng.org/og-image.png" }),
    );

    expect(item.imageUrl).toBe("https://searxng.org/og-image.png");
  });

  test("returns the same canonical category labels the list query selects", () => {
    const item = toFeedArticleDetailDtoForTest(
      rawDetailRow({ categories: ["Technology", "Software Engineering"] }),
    );

    expect(item.categories).toEqual(["Technology", "Software Engineering"]);
  });

  test("decodes category label HTML entities on feed detail DTOs", () => {
    const item = toFeedArticleDetailDtoForTest(
      rawDetailRow({ categories: ["Arts &amp; Culture"] }),
    );

    expect(item.categories).toEqual(["Arts & Culture"]);
  });
});
