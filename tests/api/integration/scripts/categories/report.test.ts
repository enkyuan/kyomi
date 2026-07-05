import { describe, expect, test } from "bun:test";
import {
  buildCategoryCoverageReport,
  parseCategoryCoverageArgs,
  summarizeCategoryCoverageReport,
} from "../../../../../scripts/categories/report";

describe("category coverage report script", () => {
  test("defaults to the last seven days across all feeds", () => {
    expect(parseCategoryCoverageArgs(["bun", "report"])).toEqual({
      days: 7,
      feedId: null,
    });
  });

  test("parses days and feed id", () => {
    expect(
      parseCategoryCoverageArgs(["bun", "report", "--days", "14", "--feed-id", "feed-1"]),
    ).toEqual({
      days: 14,
      feedId: "feed-1",
    });
  });

  test("rejects malformed day windows", () => {
    expect(() => parseCategoryCoverageArgs(["bun", "report", "--days", "0"])).toThrow(
      "Invalid --days value: 0",
    );
    expect(() => parseCategoryCoverageArgs(["bun", "report", "--days", "abc"])).toThrow(
      "Invalid --days value: abc",
    );
  });

  test("summarizes embedding coverage and keyword fallback rate", () => {
    const report = buildCategoryCoverageReport(
      { days: 7, feedId: null },
      {
        eligible_items: 100,
        items_with_explicit_labels: 12,
        items_with_embedding: 96,
        items_with_embedding_item: 80,
        items_with_embedding_feed: 20,
        keyword_fallback_items: 4,
        unclassified_items: 0,
      },
    );

    expect(report.embeddingCoveragePercent).toBe(96);
    expect(report.keywordFallbackPercent).toBe(4);
    expect(summarizeCategoryCoverageReport(report)).toBe(
      "CATEGORY COVERAGE (all feeds, last 7d): 100 recent items; " +
        "embedding coverage 96.00% (96 items: 80 item-level, 20 feed-level); " +
        "keyword fallback 4.00% (4 items); " +
        "explicit labels present on 12 items; unclassified 0 items.",
    );
  });

  test("handles an empty recent window", () => {
    const report = buildCategoryCoverageReport({ days: 30, feedId: "feed-1" }, null);

    expect(report.embeddingCoveragePercent).toBe(0);
    expect(report.keywordFallbackPercent).toBe(0);
    expect(summarizeCategoryCoverageReport(report)).toBe(
      "CATEGORY COVERAGE (feed feed-1, last 30d): 0 recent items; " +
        "embedding coverage 0.00% (0 items: 0 item-level, 0 feed-level); " +
        "keyword fallback 0.00% (0 items); " +
        "explicit labels present on 0 items; unclassified 0 items.",
    );
  });
});
