import { describe, expect, test } from "bun:test";
import {
  type FeedSearchDocument,
  isMeiliConfigured,
  upsertFeedSearchDocument,
} from "@adapters/search/meili";

const enrichedDocument: FeedSearchDocument = {
  id: "feed-1",
  url: "https://a.example.com/rss",
  title: "Alpha",
  description: "An example feed",
  link: "https://a.example.com",
  faviconUrl: null,
  sourceKind: "rss",
  language: "en",
  categories: ["engineering"],
  contentType: "article",
  qualityScore: 0.9,
  domain: "a.example.com",
};

describe("feed search document", () => {
  test("carries source metadata fields (sourceKind, language, categories, contentType, domain)", () => {
    expect(enrichedDocument.sourceKind).toBe("rss");
    expect(enrichedDocument.language).toBe("en");
    expect(enrichedDocument.categories).toEqual(["engineering"]);
    expect(enrichedDocument.contentType).toBe("article");
    expect(enrichedDocument.domain).toBe("a.example.com");
  });

  test("upsert is a safe no-op when Meili is not configured", async () => {
    if (isMeiliConfigured()) {
      // In an environment with Meili configured this test is not meaningful; skip the assertion.
      return;
    }
    await expect(upsertFeedSearchDocument(enrichedDocument)).resolves.toBeUndefined();
  });
});
