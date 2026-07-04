import { describe, expect, test } from "bun:test";
import {
  domainFromUrl,
  normalizeImportRecord,
  parseRecord,
  reportValidation,
  toCategorySlug,
  type NormalizedImportRecord,
  type ValidationReport,
} from "../../../../scripts/catalog/import-core";

describe("catalog import metadata preservation", () => {
  test("parseRecord carries source/language/category/content_type/quality_score", () => {
    const record = parseRecord(
      JSON.stringify({
        feed_url: "https://a.example.com/rss",
        title: "Alpha",
        link: "https://a.example.com",
        source: "feeeed",
        language: "en",
        category: "Engineering",
        content_type: "article",
        quality_score: 0.9,
      }),
    );
    expect(record).not.toBeNull();
    expect(record).toMatchObject({
      source: "feeeed",
      language: "en",
      category: "Engineering",
      content_type: "article",
      quality_score: 0.9,
    });
  });

  test("parseRecord rejects records without feed_url", () => {
    expect(parseRecord(JSON.stringify({ title: "no url" }))).toBeNull();
  });

  test("normalizeImportRecord maps catalog fields onto the feed shape", () => {
    const normalized = normalizeImportRecord({
      feed_url: "https://a.example.com/rss",
      title: "Alpha",
      link: "https://a.example.com",
      source: "feeeed",
      language: "en",
      category: "Engineering",
      content_type: "article",
      quality_score: 0.9,
    });
    expect(normalized).toMatchObject({
      catalogSource: "feeeed",
      language: "en",
      category: "Engineering",
      contentType: "article",
      qualityScore: 0.9,
    });
    expect(normalized.canonicalUrl).toContain("a.example.com");
  });

  test("toCategorySlug normalizes to lowercase ASCII", () => {
    expect(toCategorySlug("Engineering & Tech")).toBe("engineering-tech");
    expect(toCategorySlug("  Café News  ")).toBe("cafe-news");
    expect(toCategorySlug("AI/ML")).toBe("ai-ml");
    expect(toCategorySlug("!!!")).toBe("");
  });

  test("domainFromUrl strips www and returns hostname", () => {
    expect(domainFromUrl("https://www.example.com/rss")).toBe("example.com");
    expect(domainFromUrl("not a url")).toBeNull();
  });

  test("reportValidation counts missing site url, language, and category", () => {
    const report: ValidationReport = {
      missingTitle: 0,
      missingSiteUrl: 0,
      missingLanguage: 0,
      missingCategory: 0,
    };
    const record: NormalizedImportRecord = {
      canonicalUrl: "https://b.example.com/feed",
      title: "https://b.example.com/feed",
      description: null,
      link: null,
      catalogSource: "feedspot",
      language: null,
      category: null,
      contentType: null,
      qualityScore: null,
    };
    reportValidation(report, record, record.title === record.canonicalUrl);
    expect(report).toEqual({
      missingTitle: 1,
      missingSiteUrl: 1,
      missingLanguage: 1,
      missingCategory: 1,
    });
  });
});
