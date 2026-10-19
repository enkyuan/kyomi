import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  EMBEDDING_CLASSIFIER_MODEL_ID,
  resetPrototypeCache,
  type EmbeddingClassifierConfig,
} from "@kyomi/worker";
import {
  backfillItemColumns,
  inferFeedCategories,
  inferItemEmbeddings,
  inferItemCategories,
  mapWithConcurrency,
  nextItemBackfillBatchSize,
  parseBackfillArgs,
  summarizeBackfill,
  syncsItemLabels,
} from "../../../../../apps/api/src/modules/catalog/backfill";
import { FAKE_CATEGORY_MODEL } from "../feeds/refresh/fake-category-model";

const originalFetch = globalThis.fetch;
const FAKE_EMBEDDING_CONFIG: EmbeddingClassifierConfig = {
  apiKey: "test-key",
  apiUrl: "https://fake-embeddings.test/embed",
  categoryModel: FAKE_CATEGORY_MODEL,
};
const UNIT_X = [1, 0, 0];
const ORTHOGONAL_Z = [0, 0, 1];

beforeEach(() => {
  resetPrototypeCache();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetPrototypeCache();
});

describe("category backfill script", () => {
  test("defaults to dry-run with capped item scans and bounded concurrency", () => {
    expect(parseBackfillArgs(["bun", "backfill"])).toEqual({
      apply: false,
      all: false,
      limit: 500,
      batchSize: 1000,
      itemLimit: 50,
      feedId: null,
      classifier: "keyword",
      recentDays: null,
      concurrency: 8,
      normalizeExisting: false,
      retryFailed: false,
    });
  });

  test("parses apply, limit, item limit, feed id, classifier, recent days, and concurrency", () => {
    expect(
      parseBackfillArgs([
        "bun",
        "backfill",
        "--apply",
        "--normalize-existing",
        "--retry-failed",
        "--limit",
        "25",
        "--batch-size",
        "1250",
        "--item-limit",
        "10",
        "--feed-id",
        "feed-1",
        "--classifier",
        "embedding",
        "--recent-days",
        "7",
        "--concurrency",
        "3",
        "--normalize-existing",
      ]),
    ).toEqual({
      apply: true,
      all: false,
      limit: 25,
      batchSize: 1250,
      itemLimit: 10,
      feedId: "feed-1",
      classifier: "embedding",
      recentDays: 7,
      concurrency: 3,
      normalizeExisting: true,
      retryFailed: true,
    });

    expect(parseBackfillArgs(["bun", "backfill", "--embedding"]).classifier).toBe("embedding");
    expect(parseBackfillArgs(["bun", "backfill", "--all-items"]).itemLimit).toBeNull();
    expect(parseBackfillArgs(["bun", "backfill", "--all"])).toMatchObject({
      all: true,
      itemLimit: null,
      recentDays: null,
    });
  });

  test("rejects malformed throttling flags instead of silently scanning too much", () => {
    expect(() => parseBackfillArgs(["bun", "backfill", "--item-limit", "abc"])).toThrow(
      "Invalid --item-limit value: abc",
    );
    expect(() => parseBackfillArgs(["bun", "backfill", "--item-limit", "0"])).toThrow(
      "Invalid --item-limit value: 0",
    );
    expect(() => parseBackfillArgs(["bun", "backfill", "--item-limit", "-5"])).toThrow(
      "Invalid --item-limit value: -5",
    );
    expect(() => parseBackfillArgs(["bun", "backfill", "--recent-days", "soon"])).toThrow(
      "Invalid --recent-days value: soon",
    );
    expect(() => parseBackfillArgs(["bun", "backfill", "--recent-days", "0"])).toThrow(
      "Invalid --recent-days value: 0",
    );
    expect(() => parseBackfillArgs(["bun", "backfill", "--concurrency", "0"])).toThrow(
      "Invalid --concurrency value: 0",
    );
    expect(() =>
      parseBackfillArgs(["bun", "backfill", "--all-items", "--item-limit", "50"]),
    ).toThrow("--all-items cannot be combined with --item-limit");
  });

  test("rejects malformed classifier flags", () => {
    expect(() => parseBackfillArgs(["bun", "backfill", "--classifier", "semantic"])).toThrow(
      "Invalid --classifier value: semantic",
    );
    expect(() =>
      parseBackfillArgs(["bun", "backfill", "--classifier", "keyword", "--embedding"]),
    ).toThrow("--embedding cannot be combined with --classifier keyword");
  });

  test("classifies non-allowlisted feed items during backfill", () => {
    const labels = inferItemCategories(
      {
        title: "Daily Links",
        description: "A mixed collection of links.",
        url: "https://example.com/feed.xml",
        link: "https://example.com",
        sourceKind: "rss",
      },
      {
        title: "Bitcoin market rally lifts crypto stocks",
        summary: "Investors watch market prices, stock performance, and crypto trading volume.",
        contentText: null,
        link: "https://finance.yahoo.com/news/bitcoin-market-rally",
        canonicalUrl: "https://finance.yahoo.com/news/bitcoin-market-rally",
      },
    ).map((category) => category.label);

    expect(labels).toEqual(["Finance & Markets"]);
  });

  test("classifies from ready extracted text instead of thin feed text", () => {
    const feed = {
      title: "Daily Links",
      description: "A mixed collection of links.",
      url: "https://example.com/feed.xml",
      link: "https://example.com",
      sourceKind: "rss",
    };
    const item = {
      title: "Weekly notes",
      summary: null,
      contentText: "Read more",
      link: "https://example.com/weekly-notes",
      canonicalUrl: "https://example.com/weekly-notes",
    };

    expect(inferItemCategories(feed, item)).toEqual([]);
    expect(
      inferItemCategories(feed, {
        ...item,
        extractedContentText:
          "Investors watch market prices, stock performance, crypto trading, and personal finance.",
      }).map((category) => category.label),
    ).toEqual(["Finance & Markets"]);
    // A ready extraction with empty text is what extraction re-classified from, so it wins.
    expect(
      inferItemCategories(feed, {
        ...item,
        contentText:
          "Investors watch market prices, stock performance, crypto trading, and finance.",
        extractedContentText: "",
      }),
    ).toEqual([]);
  });

  test("keeps refresh labels when backfill abstains on ready extracted text", () => {
    const item = {
      title: "Weekly notes",
      summary: null,
      contentText: "Read more",
      link: "https://example.com/weekly-notes",
      canonicalUrl: "https://example.com/weekly-notes",
    };
    const label = { label: "Finance & Markets", confidence: 0.9 };

    // An abstention on ready extracted text leaves the item's existing rows alone.
    expect(syncsItemLabels({ ...item, extractedContentText: "Thin page text" }, [])).toBe(false);
    expect(syncsItemLabels({ ...item, extractedContentText: "" }, [])).toBe(false);
    // New labels, or a classification from feed text, still replace them.
    expect(syncsItemLabels({ ...item, extractedContentText: "Thin page text" }, [label])).toBe(
      true,
    );
    expect(syncsItemLabels({ ...item, extractedContentText: null }, [])).toBe(true);
    expect(syncsItemLabels(item, [])).toBe(true);
  });

  test("loads extracted text only for items whose extraction is ready", () => {
    const query = new PgDialect().sqlToQuery(backfillItemColumns.extractedContentText);

    expect(query.sql).toContain(
      `CASE WHEN "feed_items"."extracted_content_status" = 'ready' THEN "feed_items"."extracted_content_text" END`,
    );
  });

  test("suppresses broad feed classifier fallback during backfill", () => {
    const result = inferFeedCategories({
      title: "Hacker News",
      description: "Links for hackers",
      url: "https://news.ycombinator.com/rss",
      link: "https://news.ycombinator.com",
      sourceKind: "rss",
    });

    expect(result.categories).toEqual([]);
    expect(result.suppressedFallback).toBe(true);
  });

  test("keeps single-topic feed classifier fallback during backfill", () => {
    const result = inferFeedCategories({
      title: "Airbnb Engineering",
      description: "Software engineering posts about infrastructure and architecture.",
      url: "https://medium.com/feed/airbnb-engineering",
      link: "https://medium.com/airbnb-engineering",
      sourceKind: "rss",
    });

    expect(result.categories.map((category) => category.label)).toEqual(["Software Engineering"]);
    expect(result.suppressedFallback).toBe(false);
  });

  test("classifies a feed's items with the embedding classifier in one request", async () => {
    const itemRequests: string[][] = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { input: string[] };
      itemRequests.push(body.input);
      return new Response(
        JSON.stringify({
          data: body.input.map((_, index) => ({
            embedding: index === 0 ? UNIT_X : ORTHOGONAL_Z,
            index,
          })),
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const labelsById = await inferItemEmbeddings(
      {
        title: "Daily Links",
        description: "A mixed collection of links.",
        url: "https://example.com/feed.xml",
        link: "https://example.com",
        sourceKind: "rss",
      },
      [
        {
          id: "item-1",
          title: "A compiler engineer's guide to TypeScript infrastructure",
          summary: null,
          contentText: null,
          link: "https://example.com/compiler",
          canonicalUrl: "https://example.com/compiler",
        },
        {
          id: "item-2",
          title: "Weekend reading",
          summary: null,
          contentText: null,
          link: "https://example.com/weekend",
          canonicalUrl: "https://example.com/weekend",
        },
      ],
      FAKE_EMBEDDING_CONFIG,
    );

    expect(itemRequests).toHaveLength(1);
    expect(labelsById.get("item-1")?.map((category) => category.label)).toEqual([
      "Software Engineering",
    ]);
    expect(labelsById.get("item-2")).toEqual([]);
  });

  test("computes all-item and capped item backfill batches", () => {
    expect(nextItemBackfillBatchSize({ itemLimit: null, processed: 0 })).toBe(500);
    expect(nextItemBackfillBatchSize({ itemLimit: null, processed: 1500 })).toBe(500);
    expect(nextItemBackfillBatchSize({ itemLimit: 50, processed: 0 })).toBe(50);
    expect(nextItemBackfillBatchSize({ itemLimit: 50, processed: 50 })).toBeNull();
    expect(nextItemBackfillBatchSize({ itemLimit: 10, processed: 0 })).toBe(10);
    expect(nextItemBackfillBatchSize({ itemLimit: 750, processed: 0 })).toBe(500);
    expect(nextItemBackfillBatchSize({ itemLimit: 750, processed: 500 })).toBe(250);
    expect(nextItemBackfillBatchSize({ itemLimit: 750, processed: 750 })).toBeNull();
  });

  test("limits concurrent item classification work", async () => {
    let active = 0;
    let maxActive = 0;

    const values = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return value * 2;
    });

    expect(values).toEqual([2, 4, 6, 8, 10]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  test("summarizes dry-run and apply output", () => {
    expect(
      summarizeBackfill({
        apply: false,
        classifierMethod: "keyword",
        classifierModelId: "keyword-v1",
        feedsScanned: 2,
        feedsWithClassifierCategories: 2,
        feedClassifierFallbacksSuppressed: 1,
        feedsFailed: 0,
        itemsScanned: 4,
        itemsWithClassifierCategories: 1,
        itemClassifierAbstentions: 3,
        itemEmbeddingFailures: 0,
        feedBackfillStatusesRecorded: 0,
        normalizedExistingAssignments: true,
        assignmentsScanned: 5,
        assignmentsRewritten: 2,
        assignmentsDroppedUnmapped: 1,
      }),
    ).toBe(
      "DRY RUN (keyword/keyword-v1): scanned 2 feeds and 4 items; would write classifier categories for 2 feeds and 1 items. " +
        "would rewrite 2 of 5 existing assignments to canonical categories and dropped 1 unmapped assignments. " +
        "Suppressed classifier feed fallback for 1 broad feeds; item classifier abstained on 3 items. " +
        "would write coverage status for 0 feeds; 0 feeds failed.",
    );

    expect(
      summarizeBackfill({
        apply: true,
        classifierMethod: "embedding",
        classifierModelId: EMBEDDING_CLASSIFIER_MODEL_ID,
        feedsScanned: 2,
        feedsWithClassifierCategories: 2,
        feedClassifierFallbacksSuppressed: 1,
        feedsFailed: 1,
        itemsScanned: 4,
        itemsWithClassifierCategories: 1,
        itemClassifierAbstentions: 3,
        itemEmbeddingFailures: 3,
        feedBackfillStatusesRecorded: 2,
        normalizedExistingAssignments: false,
        assignmentsScanned: 5,
        assignmentsRewritten: 2,
        assignmentsDroppedUnmapped: 1,
      }),
    ).toBe(
      `APPLIED (embedding/${EMBEDDING_CLASSIFIER_MODEL_ID}): scanned 2 feeds and 4 items; wrote classifier categories for 2 feeds and 1 items. ` +
        "Skipped existing assignment normalization. " +
        "Suppressed classifier feed fallback for 1 broad feeds; item classifier abstained on 3 items. " +
        "wrote coverage status for 2 feeds; 1 feed failed; 3 embedding failures.",
    );
  });
});
