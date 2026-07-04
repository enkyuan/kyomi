import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  EMBEDDING_CLASSIFIER_MODEL_ID,
  resetCategoryPrototypeCacheForTests,
  type EmbeddingClassifierConfig,
} from "@kyomi/worker";
import {
  inferBackfillFeedCategories,
  inferBackfillItemCategoriesByEmbedding,
  inferBackfillItemCategories,
  nextItemBackfillBatchSize,
  parseBackfillArgs,
  summarizeBackfill,
} from "../../../../../scripts/categories/backfill";

const originalFetch = globalThis.fetch;
const FAKE_EMBEDDING_CONFIG: EmbeddingClassifierConfig = {
  apiKey: "test-key",
  apiUrl: "https://fake.voyage.test/v1/embeddings",
};
const UNIT_X = [1, 0, 0];
const ORTHOGONAL_Z = [0, 0, 1];

beforeEach(() => {
  resetCategoryPrototypeCacheForTests();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetCategoryPrototypeCacheForTests();
});

describe("category backfill script", () => {
  test("defaults to dry-run and scans all items", () => {
    expect(parseBackfillArgs(["bun", "backfill"])).toEqual({
      apply: false,
      limit: 500,
      itemLimit: null,
      feedId: null,
      classifier: "keyword",
    });
  });

  test("parses apply, limit, item limit, feed id, and classifier", () => {
    expect(
      parseBackfillArgs([
        "bun",
        "backfill",
        "--apply",
        "--limit",
        "25",
        "--item-limit",
        "10",
        "--feed-id",
        "feed-1",
        "--classifier",
        "embedding",
      ]),
    ).toEqual({
      apply: true,
      limit: 25,
      itemLimit: 10,
      feedId: "feed-1",
      classifier: "embedding",
    });

    expect(parseBackfillArgs(["bun", "backfill", "--embedding"]).classifier).toBe("embedding");
  });

  test("rejects a malformed --item-limit instead of silently scanning all items", () => {
    expect(() => parseBackfillArgs(["bun", "backfill", "--item-limit", "abc"])).toThrow(
      "Invalid --item-limit value: abc",
    );
    expect(() => parseBackfillArgs(["bun", "backfill", "--item-limit", "0"])).toThrow(
      "Invalid --item-limit value: 0",
    );
    expect(() => parseBackfillArgs(["bun", "backfill", "--item-limit", "-5"])).toThrow(
      "Invalid --item-limit value: -5",
    );
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
    const labels = inferBackfillItemCategories(
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

  test("suppresses broad feed classifier fallback during backfill", () => {
    const result = inferBackfillFeedCategories({
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
    const result = inferBackfillFeedCategories({
      title: "Airbnb Engineering",
      description: "Software engineering posts about infrastructure and architecture.",
      url: "https://medium.com/feed/airbnb-engineering",
      link: "https://medium.com/airbnb-engineering",
      sourceKind: "rss",
    });

    expect(result.categories.map((category) => category.label)).toEqual(["Software Engineering"]);
    expect(result.suppressedFallback).toBe(false);
  });

  test("can classify item categories with the embedding classifier during backfill", async () => {
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { input: string[] };
      const isPrototypeCall = body.input.length > 1;
      if (isPrototypeCall) {
        const embeddings = body.input.map((_, i) => (i < 4 ? UNIT_X : ORTHOGONAL_Z));
        return new Response(
          JSON.stringify({ data: embeddings.map((e, i) => ({ embedding: e, index: i })) }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ data: [{ embedding: UNIT_X, index: 0 }] }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const labels = (
      await inferBackfillItemCategoriesByEmbedding(
        {
          title: "Daily Links",
          description: "A mixed collection of links.",
          url: "https://example.com/feed.xml",
          link: "https://example.com",
          sourceKind: "rss",
        },
        {
          title: "A compiler engineer's guide to TypeScript infrastructure",
          summary: null,
          contentText: null,
          link: "https://example.com/compiler",
          canonicalUrl: "https://example.com/compiler",
        },
        FAKE_EMBEDDING_CONFIG,
      )
    ).map((category) => category.label);

    expect(labels).toEqual(["Software Engineering"]);
  });

  test("computes all-item and capped item backfill batches", () => {
    expect(nextItemBackfillBatchSize({ itemLimit: null, processed: 0 })).toBe(500);
    expect(nextItemBackfillBatchSize({ itemLimit: null, processed: 1500 })).toBe(500);
    expect(nextItemBackfillBatchSize({ itemLimit: 10, processed: 0 })).toBe(10);
    expect(nextItemBackfillBatchSize({ itemLimit: 750, processed: 0 })).toBe(500);
    expect(nextItemBackfillBatchSize({ itemLimit: 750, processed: 500 })).toBe(250);
    expect(nextItemBackfillBatchSize({ itemLimit: 750, processed: 750 })).toBeNull();
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
        itemsScanned: 4,
        itemsWithClassifierCategories: 1,
        itemClassifierAbstentions: 3,
        assignmentsScanned: 5,
        assignmentsRewritten: 2,
        assignmentsDroppedUnmapped: 1,
      }),
    ).toBe(
      "DRY RUN (keyword/keyword-v1): scanned 2 feeds and 4 items; would write classifier categories for 2 feeds and 1 items. " +
        "would rewrite 2 of 5 existing assignments to canonical categories and dropped 1 unmapped assignments. " +
        "Suppressed classifier feed fallback for 1 broad feeds; item classifier abstained on 3 items.",
    );

    expect(
      summarizeBackfill({
        apply: true,
        classifierMethod: "embedding",
        classifierModelId: EMBEDDING_CLASSIFIER_MODEL_ID,
        feedsScanned: 2,
        feedsWithClassifierCategories: 2,
        feedClassifierFallbacksSuppressed: 1,
        itemsScanned: 4,
        itemsWithClassifierCategories: 1,
        itemClassifierAbstentions: 3,
        assignmentsScanned: 5,
        assignmentsRewritten: 2,
        assignmentsDroppedUnmapped: 1,
      }),
    ).toBe(
      `APPLIED (embedding/${EMBEDDING_CLASSIFIER_MODEL_ID}): scanned 2 feeds and 4 items; wrote classifier categories for 2 feeds and 1 items. ` +
        "rewrote 2 of 5 existing assignments to canonical categories and dropped 1 unmapped assignments. " +
        "Suppressed classifier feed fallback for 1 broad feeds; item classifier abstained on 3 items.",
    );
  });
});
