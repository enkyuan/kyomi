import { describe, expect, test } from "bun:test";
import { toArticleListItemsForTest } from "@modules/articles/read/list/service";
import type { ArticleListRawRow } from "@modules/articles/read/list/dedupe";

function rawRow(overrides: Partial<ArticleListRawRow> = {}): ArticleListRawRow {
  return {
    id: "item-1",
    title: "Title",
    canonicalUrl: "https://a.example.com/1",
    link: "https://a.example.com/1",
    summary: "Summary",
    publishedAt: new Date("2026-07-01T00:00:00.000Z"),
    feedId: "feed-1",
    feedUrl: "https://a.example.com/rss",
    feedSiteUrl: "https://a.example.com",
    feedTitle: "Alpha",
    feedFaviconUrl: null,
    isRead: false,
    isSaved: false,
    hiddenAt: null,
    categories: [],
    ...overrides,
  };
}

describe("article list item categories", () => {
  test("maps feed-level category labels onto the DTO", () => {
    const [item] = toArticleListItemsForTest([rawRow({ categories: ["Engineering", "AI"] })]);
    expect(item?.categories).toEqual(["Engineering", "AI"]);
  });

  test("defaults to an empty array when a feed has no categories", () => {
    const [item] = toArticleListItemsForTest([rawRow({ categories: [] })]);
    expect(item?.categories).toEqual([]);
  });

  test("decodes HTML entities in category labels", () => {
    const [item] = toArticleListItemsForTest([rawRow({ categories: ["Arts &amp; Culture"] })]);
    expect(item?.categories).toEqual(["Arts & Culture"]);
  });
});
