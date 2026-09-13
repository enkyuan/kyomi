import { describe, expect, test } from "bun:test";
import { toFeedArticleDetailDtoForTest } from "@modules/articles/read/detail";
import { clipToDetail } from "@modules/articles/write/clips/detail";

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

describe("article detail content", () => {
  test("normalizes feed top-level markdown to match nested reader content", () => {
    const item = toFeedArticleDetailDtoForTest(
      rawDetailRow({
        contentHtml: null,
        contentText: null,
        contentMarkdown: "## Release notes ##\n\n    const value = 1;",
        contentSource: "feed_markdown",
      }),
    );

    expect(item.contentMarkdown).toBe("## Release notes\n\n```\nconst value = 1;\n```");
    expect(item.reader.original.content.contentMarkdown).toBe(item.contentMarkdown);
  });

  test("normalizes clip top-level markdown to match nested reader content", () => {
    const item = clipToDetail({
      id: "clip-1",
      userId: "user-1",
      url: "https://example.com/article",
      title: "Article",
      content: null,
      contentHtml: null,
      contentText: "## Release notes ##\n\n    const value = 1;",
      contentMarkdown: "## Release notes ##\n\n    const value = 1;",
      contentStatus: "ready",
      contentSource: "feed_markdown",
      extractionErrorCode: null,
      extractionErrorMessage: null,
      extractedContentHtml: null,
      extractedContentText: null,
      extractedContentStatus: "pending",
      extractedContentError: null,
      extractedContentUpdatedAt: null,
      note: null,
      isRead: false,
      isSaved: false,
      createdAt: new Date("2026-07-04T00:00:00.000Z"),
      updatedAt: new Date("2026-07-04T00:00:00.000Z"),
    });

    expect(item.contentMarkdown).toBe("## Release notes\n\n```\nconst value = 1;\n```");
    expect(item.reader.original.content.contentMarkdown).toBe(item.contentMarkdown);
  });
});

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
