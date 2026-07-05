import { describe, expect, test } from "bun:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { isCanonicalCategoryLabel, MISCELLANEOUS_CATEGORY_LABEL } from "@kyomi/db";
import { buildCategoryLabelsSql, categoryLabelsSql } from "@modules/articles/read/labels";
import { toArticleListItemsForTest } from "@modules/articles/read/list/query";
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

function renderQuery(
  fragment: Parameters<PgDialect["sqlToQuery"]>[0],
): ReturnType<PgDialect["sqlToQuery"]> {
  return new PgDialect().sqlToQuery(fragment);
}

function renderSql(fragment: Parameters<PgDialect["sqlToQuery"]>[0]): string {
  return renderQuery(fragment).sql;
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

  test("category label SQL defaults to keyword classifier rows after explicit labels", () => {
    const sql = renderSql(buildCategoryLabelsSql("keyword"));

    expect(sql).toContain('"feed_item_category_assignments"');
    expect(sql).toContain('"feed_category_assignments"');
    expect(sql).toContain("classifier_method\" = 'keyword'");
    expect(sql).not.toContain("classifier_method\" = 'embedding'");
    expect(sql).toContain("raw_item_sources.source_rank < 99");
    expect(sql).toContain("raw_feed_sources.source_rank < 99");

    const explicitItem = sql.indexOf("THEN 0");
    const keywordItem = sql.indexOf("THEN 1");
    const explicitFeed = sql.indexOf("THEN 2");
    const keywordFeed = sql.indexOf("THEN 3");
    expect(explicitItem).toBeGreaterThanOrEqual(0);
    expect(keywordItem).toBeGreaterThan(explicitItem);
    expect(explicitFeed).toBeGreaterThan(keywordItem);
    expect(keywordFeed).toBeGreaterThan(explicitFeed);
  });

  test("category label SQL can rank embedding rows ahead of keyword rows", () => {
    const sql = renderSql(buildCategoryLabelsSql("embedding"));

    const explicitItem = sql.indexOf("THEN 0");
    const embeddingItem = sql.indexOf("= 'embedding' THEN 1");
    const keywordItem = sql.indexOf("= 'keyword' THEN 2");
    const explicitFeed = sql.indexOf("THEN 3");
    const embeddingFeed = sql.indexOf("= 'embedding' THEN 4");
    const keywordFeed = sql.indexOf("= 'keyword' THEN 5");
    expect(explicitItem).toBeGreaterThanOrEqual(0);
    expect(embeddingItem).toBeGreaterThan(explicitItem);
    expect(keywordItem).toBeGreaterThan(embeddingItem);
    expect(explicitFeed).toBeGreaterThan(keywordItem);
    expect(embeddingFeed).toBeGreaterThan(explicitFeed);
    expect(keywordFeed).toBeGreaterThan(embeddingFeed);
    expect(sql).toContain("confidence DESC NULLS LAST");
  });

  test("embedding category label SQL uses keyword rows only as fallback rows", () => {
    const sql = renderSql(buildCategoryLabelsSql("embedding"));

    expect(sql).toContain("raw_item_sources.classifier_method IS DISTINCT FROM 'keyword'");
    expect(sql).toContain("FROM raw_item_sources AS embedding_item_sources");
    expect(sql).toContain("embedding_item_sources.classifier_method = 'embedding'");
    expect(sql).toContain("raw_feed_sources.classifier_method IS DISTINCT FROM 'keyword'");
    expect(sql).toContain("FROM raw_feed_sources AS embedding_feed_sources");
    expect(sql).toContain("embedding_feed_sources.classifier_method = 'embedding'");
  });

  test("category label SQL only uses feed fallbacks when no item labels are eligible", () => {
    const sql = renderSql(buildCategoryLabelsSql("embedding"));

    expect(sql).toContain("AND NOT EXISTS (SELECT 1 FROM item_sources)");
  });

  test("category label SQL suppresses classifier Miscellaneous rows from chips", () => {
    const query = renderQuery(buildCategoryLabelsSql("embedding"));

    expect(query.params).toContain(MISCELLANEOUS_CATEGORY_LABEL);
    expect(query.sql).toMatch(/raw_item_sources\.label <> \$\d+/);
    expect(query.sql).toMatch(/raw_feed_sources\.label <> \$\d+/);
    expect(query.sql).toContain("assignment_provenance IS DISTINCT FROM 'classifier'");
  });

  test("category label SQL caps the DTO at two labels per item", () => {
    // Categories are normalized to canonical labels before this query ever runs (see
    // packages/worker/src/services/feed/categories.ts), so this LIMIT is the only remaining
    // enforcement point for "chips show at most two categories".
    const sql = renderSql(categoryLabelsSql);
    expect(sql).toMatch(/LIMIT 2\s*\)\s*AS fc/);
  });

  test("DTO categories only ever contain canonical labels sourced from the categories table", () => {
    // The article list query selects `categories.label` directly (see categoryLabelsSql
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
