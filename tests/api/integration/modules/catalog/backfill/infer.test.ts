import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { PgDialect } from "drizzle-orm/pg-core";
import type { EmbeddingClassifierConfig } from "@kyomi/ingest";
import {
  inferFeedCategories,
  inferItemCategories,
  inferItemEmbeddings,
  syncsItemLabels,
} from "@modules/catalog/backfill/infer";
import { backfillItemColumns, nextItemBackfillBatchSize } from "@modules/catalog/backfill/queries";
import { fakeEmbeddings } from "../fakes";

const EMBEDDING_CONFIG: EmbeddingClassifierConfig = {
  apiKey: "test-key",
  apiUrl: "https://fake-embeddings.test/embed",
};

const FEED = {
  title: "Daily Links",
  description: "A mixed collection of links.",
  url: "https://example.com/feed.xml",
  link: "https://example.com",
  sourceKind: "rss",
};

describe("backfill inference", () => {
  test("classifies non-allowlisted feed items during backfill", () => {
    const labels = inferItemCategories(FEED, {
      title: "Bitcoin market rally lifts crypto stocks",
      summary: "Investors watch market prices, stock performance, and crypto trading volume.",
      contentText: null,
      link: "https://finance.yahoo.com/news/bitcoin-market-rally",
      canonicalUrl: "https://finance.yahoo.com/news/bitcoin-market-rally",
    }).map((category) => category.label);

    expect(labels).toEqual(["Finance & Markets"]);
  });

  test("classifies from ready extracted text instead of thin feed text", () => {
    const item = {
      title: "Weekly notes",
      summary: null,
      contentText: "Read more",
      link: "https://example.com/weekly-notes",
      canonicalUrl: "https://example.com/weekly-notes",
    };

    expect(inferItemCategories(FEED, item)).toEqual([]);
    expect(
      inferItemCategories(FEED, {
        ...item,
        extractedContentText:
          "Investors watch market prices, stock performance, crypto trading, and personal finance.",
      }).map((category) => category.label),
    ).toEqual(["Finance & Markets"]);
    // A ready extraction with empty text is what extraction re-classified from, so it wins.
    expect(
      inferItemCategories(FEED, {
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

  test("classifies a feed's items through the embeddings service in one request", async () => {
    const requests: string[][] = [];
    const embeddings = fakeEmbeddings({
      classifyItems: (inputs) => {
        requests.push(inputs.map((input) => input.id));
        return Effect.succeed(
          new Map(
            inputs.map((input) => [
              input.id,
              {
                categories:
                  input.id === "item-1" ? [{ label: "Software Engineering", confidence: 0.9 }] : [],
              },
            ]),
          ),
        );
      },
    });

    const labelsById = await Effect.runPromise(
      inferItemEmbeddings(
        FEED,
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
        EMBEDDING_CONFIG,
      ).pipe(Effect.provide(embeddings)),
    );

    expect(requests).toEqual([["item-1", "item-2"]]);
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
});
