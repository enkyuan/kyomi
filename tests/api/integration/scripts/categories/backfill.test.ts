import { describe, expect, test } from "bun:test";
import { parseBackfillArgs, summarizeBackfill } from "../../../../../scripts/categories/backfill";

describe("category backfill script", () => {
  test("defaults to dry-run", () => {
    expect(parseBackfillArgs(["bun", "backfill"])).toEqual({
      apply: false,
      limit: 500,
      itemLimit: 50,
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

  test("summarizes dry-run and apply output", () => {
    expect(
      summarizeBackfill({
        apply: false,
        feedsScanned: 2,
        feedsWithClassifierCategories: 2,
        itemsScanned: 4,
        itemsWithClassifierCategories: 1,
      }),
    ).toBe(
      "DRY RUN: scanned 2 feeds and 4 items; would write classifier categories for 2 feeds and 1 items.",
    );

    expect(
      summarizeBackfill({
        apply: true,
        feedsScanned: 2,
        feedsWithClassifierCategories: 2,
        itemsScanned: 4,
        itemsWithClassifierCategories: 1,
      }),
    ).toBe(
      "APPLIED: scanned 2 feeds and 4 items; wrote classifier categories for 2 feeds and 1 items.",
    );
  });
});
