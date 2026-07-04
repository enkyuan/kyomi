import { describe, expect, test } from "bun:test";
import {
  inferBackfillFeedCategories,
  inferBackfillItemCategories,
  nextItemBackfillBatchSize,
  parseBackfillArgs,
  summarizeBackfill,
} from "../../../../../scripts/categories/backfill";

describe("category backfill script", () => {
  test("defaults to dry-run and scans all items", () => {
    expect(parseBackfillArgs(["bun", "backfill"])).toEqual({
      apply: false,
      limit: 500,
      itemLimit: null,
      feedId: null,
    });
  });

  test("parses apply, limit, item limit, and feed id", () => {
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
      ]),
    ).toEqual({
      apply: true,
      limit: 25,
      itemLimit: 10,
      feedId: "feed-1",
    });
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
      "DRY RUN: scanned 2 feeds and 4 items; would write classifier categories for 2 feeds and 1 items. " +
        "would rewrite 2 of 5 existing assignments to canonical categories and dropped 1 unmapped assignments. " +
        "Suppressed classifier feed fallback for 1 broad feeds; item classifier abstained on 3 items.",
    );

    expect(
      summarizeBackfill({
        apply: true,
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
      "APPLIED: scanned 2 feeds and 4 items; wrote classifier categories for 2 feeds and 1 items. " +
        "rewrote 2 of 5 existing assignments to canonical categories and dropped 1 unmapped assignments. " +
        "Suppressed classifier feed fallback for 1 broad feeds; item classifier abstained on 3 items.",
    );
  });
});
