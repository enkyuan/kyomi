import { describe, expect, test } from "bun:test";
import {
  feedCategoryLabelsSql,
  toArticleListItemsForTest,
} from "@modules/articles/read/list/service";
import type { ArticleListRawRow } from "@modules/articles/read/list/dedupe";
import { articleListItemSchema } from "@modules/articles/schemas";
import { feedCategoryAssignments, feedItemCategoryAssignments } from "@kyomi/db";

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

function queryContainsReference(
  value: unknown,
  target: unknown,
  seen = new Set<unknown>(),
): boolean {
  if (value === target) {
    return true;
  }
  if (!value || typeof value !== "object" || seen.has(value)) {
    return false;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((entry) => queryContainsReference(entry, target, seen));
  }
  return Object.values(value as Record<string, unknown>).some((entry) =>
    queryContainsReference(entry, target, seen),
  );
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

  test("response schema includes categories so Elysia does not strip it", () => {
    // Guards against the API returning categories that get cleaned off the wire because the
    // runtime response schema (not just the TS type) was missing the field.
    expect(articleListItemSchema.properties).toHaveProperty("categories");
  });

  test("category label SQL reads item-level categories before feed-level fallback", () => {
    expect(
      queryContainsReference(feedCategoryLabelsSql, feedItemCategoryAssignments.categoryId),
    ).toBe(true);
    expect(queryContainsReference(feedCategoryLabelsSql, feedCategoryAssignments.categoryId)).toBe(
      true,
    );
  });
});
