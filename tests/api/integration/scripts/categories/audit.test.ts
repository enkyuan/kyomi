import { describe, expect, test } from "bun:test";
import {
  formatCategoryAuditOutput,
  parseAuditLabelJsonl,
  parseCategoryAuditArgs,
  runCategoryAudit,
  scoreCategoryAuditItems,
  summarizeCategoryAuditScore,
  type CategoryAuditArgs,
  type CategoryAuditItem,
} from "../../../../../scripts/categories/audit";

const DEFAULT_ARGS: CategoryAuditArgs = {
  days: 7,
  limit: 100,
  feedId: null,
  labelsFile: null,
  format: "jsonl",
};

function auditItem(
  feedItemId: string,
  keywordCategories: string[],
  embeddingCategories: string[],
): CategoryAuditItem {
  return {
    feedItemId,
    title: `Title ${feedItemId}`,
    url: `https://example.com/${feedItemId}`,
    canonicalUrl: `https://example.com/${feedItemId}`,
    publishedAt: "2026-07-05T00:00:00.000Z",
    feedId: "feed-1",
    feedTitle: "Example Feed",
    feedUrl: "https://example.com/feed.xml",
    explicitCategories: [],
    keywordCategories,
    embeddingCategories,
  };
}

describe("category audit script", () => {
  test("defaults to a seven-day, hundred-item JSONL sample", () => {
    expect(parseCategoryAuditArgs(["bun", "audit"])).toEqual(DEFAULT_ARGS);
  });

  test("parses optional filters, label file, and summary format", () => {
    expect(
      parseCategoryAuditArgs([
        "bun",
        "audit",
        "--days",
        "14",
        "--limit",
        "25",
        "--feed-id",
        "feed-1",
        "--labels-file",
        "/tmp/labels.jsonl",
        "--format",
        "summary",
      ]),
    ).toEqual({
      days: 14,
      limit: 25,
      feedId: "feed-1",
      labelsFile: "/tmp/labels.jsonl",
      format: "summary",
    });
  });

  test("rejects malformed numeric and format flags", () => {
    expect(() => parseCategoryAuditArgs(["bun", "audit", "--days", "0"])).toThrow(
      "Invalid --days value: 0",
    );
    expect(() => parseCategoryAuditArgs(["bun", "audit", "--limit", "abc"])).toThrow(
      "Invalid --limit value: abc",
    );
    expect(() => parseCategoryAuditArgs(["bun", "audit", "--format", "csv"])).toThrow(
      "Invalid --format value: csv",
    );
  });

  test("parses expected-label JSONL records", () => {
    expect(
      parseAuditLabelJsonl(`
        {"feedItemId":"item-1","expectedCategories":["AI & ML","AI & ML"," Business & Startups "]}
        {"feedItemId":"item-2","expectedCategories":["Software Engineering"]}
      `),
    ).toEqual([
      {
        feedItemId: "item-1",
        expectedCategories: ["AI & ML", "Business & Startups"],
      },
      {
        feedItemId: "item-2",
        expectedCategories: ["Software Engineering"],
      },
    ]);
  });

  test("rejects malformed expected-label JSONL", () => {
    expect(() => parseAuditLabelJsonl("{not-json")).toThrow("Invalid labels JSONL line 1:");
    expect(() => parseAuditLabelJsonl('{"feedItemId":"item-1"}')).toThrow(
      "expectedCategories must be an array",
    );
    expect(() =>
      parseAuditLabelJsonl(`
        {"feedItemId":"item-1","expectedCategories":[]}
        {"feedItemId":"item-1","expectedCategories":[]}
      `),
    ).toThrow("duplicate feedItemId item-1");
  });

  test("scores keyword and embedding labels against expected categories", () => {
    const report = scoreCategoryAuditItems(
      [
        auditItem("item-1", ["AI & ML", "Business & Startups"], ["AI & ML"]),
        auditItem("item-2", ["Software Engineering"], ["Business & Startups"]),
      ],
      [
        { feedItemId: "item-1", expectedCategories: ["AI & ML"] },
        { feedItemId: "item-2", expectedCategories: ["Business & Startups"] },
        { feedItemId: "missing", expectedCategories: ["Culture & Society"] },
      ],
    );

    expect(report.labeledItems).toBe(2);
    expect(report.missingItemIds).toEqual(["missing"]);
    expect(report.keyword).toMatchObject({
      labeledItems: 2,
      truePositives: 1,
      falsePositives: 2,
      falseNegatives: 1,
    });
    expect(report.keyword.precision).toBeCloseTo(1 / 3);
    expect(report.keyword.recall).toBeCloseTo(1 / 2);
    expect(report.keyword.f1).toBeCloseTo(0.4);
    expect(report.embedding).toMatchObject({
      labeledItems: 2,
      truePositives: 2,
      falsePositives: 0,
      falseNegatives: 0,
      precision: 1,
      recall: 1,
      f1: 1,
    });
  });

  test("does not query recent items for an empty label-id list", async () => {
    let queried = false;
    const items = await runCategoryAudit(
      DEFAULT_ARGS,
      {
        execute: () => {
          queried = true;
          return [];
        },
      },
      [],
    );

    expect(items).toEqual([]);
    expect(queried).toBe(false);
  });

  test("formats samples as JSONL and score reports as summary text", () => {
    const item = auditItem("item-1", ["AI & ML"], ["AI & ML"]);
    expect(formatCategoryAuditOutput([item], DEFAULT_ARGS)).toBe(JSON.stringify(item));

    const score = scoreCategoryAuditItems(
      [item],
      [{ feedItemId: "item-1", expectedCategories: ["AI & ML"] }],
    );

    expect(summarizeCategoryAuditScore(score)).toBe(
      "CATEGORY AUDIT SCORE: scored 1 labeled items; keyword P=1.000 R=1.000 F1=1.000 TP=1 FP=0 FN=0; " +
        "embedding P=1.000 R=1.000 F1=1.000 TP=1 FP=0 FN=0; missing 0 labeled items.",
    );
    expect(formatCategoryAuditOutput([item], { ...DEFAULT_ARGS, format: "summary" }, score)).toBe(
      summarizeCategoryAuditScore(score),
    );
  });
});
