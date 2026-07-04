import { describe, expect, test } from "bun:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { isCanonicalCategoryLabel } from "@kyomi/db";
import {
  feedCategoryLabelsSql,
  toArticleListItemsForTest,
} from "@modules/articles/read/list/service";
import type { ArticleListRawRow } from "@modules/articles/read/list/dedupe";
import { articleListItemSchema } from "@modules/articles/schemas";

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

function renderSql(fragment: Parameters<PgDialect["sqlToQuery"]>[0]): string {
  return new PgDialect().sqlToQuery(fragment).sql;
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

  test("category label SQL ranks explicit item labels before classifier fallbacks", () => {
    const sql = renderSql(feedCategoryLabelsSql);

    expect(sql).toContain('"feed_item_category_assignments"');
    expect(sql).toContain('"feed_category_assignments"');
    expect(sql).toContain("= 'classifier'");

    // Ranks: 0 explicit item, 1 classifier item, 2 explicit feed, 3 classifier feed.
    const itemExplicit = sql.indexOf("THEN 1 ELSE 0 END");
    const feedExplicit = sql.indexOf("THEN 3 ELSE 2 END");
    expect(itemExplicit).toBeGreaterThanOrEqual(0);
    expect(feedExplicit).toBeGreaterThan(itemExplicit);
  });

  test("category label SQL caps the DTO at two labels per item", () => {
    // Categories are normalized to canonical labels before this query ever runs (see
    // packages/worker/src/services/feed/categories.ts), so this LIMIT is the only remaining
    // enforcement point for "chips show at most two categories".
    const sql = renderSql(feedCategoryLabelsSql);
    expect(sql).toMatch(/LIMIT 2\s*\)\s*AS fc/);
  });

  test("DTO categories only ever contain canonical labels sourced from the categories table", () => {
    // The article list query selects `categories.label` directly (see feedCategoryLabelsSql
    // and listArticleRows/listGlobalArticleRows), with no transformation in between. Write-time
    // canonicalization (Tasks 3/6/7 of the taxonomy plan) is what keeps that column
    // canonical-only; this test documents the invariant the DTO mapper relies on rather than
    // re-normalizing at read time.
    const [item] = toArticleListItemsForTest([
      rawRow({ categories: ["Software Engineering", "AI & ML"] }),
    ]);
    expect(item?.categories).toEqual(["Software Engineering", "AI & ML"]);
    for (const label of item?.categories ?? []) {
      expect(isCanonicalCategoryLabel(label)).toBe(true);
    }
  });
});
