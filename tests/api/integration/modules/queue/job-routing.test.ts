import { describe, expect, test } from "bun:test";
import {
  ARTICLE_EXTRACTION_JOBS_STREAM_KEY,
  FEED_REFRESH_JOBS_STREAM_KEY,
  OPML_JOBS_STREAM_KEY,
  getStreamKeyForJobType,
  normalizeQueueOptions,
  parseJob,
} from "@kyomi/worker";

describe("queue routing", () => {
  test("routes feed refresh jobs separately from OPML jobs", () => {
    expect(getStreamKeyForJobType("feed.refresh")).toBe(FEED_REFRESH_JOBS_STREAM_KEY);
    expect(getStreamKeyForJobType("opml.import")).toBe(OPML_JOBS_STREAM_KEY);
    expect(getStreamKeyForJobType("opml.import.feed")).toBe(OPML_JOBS_STREAM_KEY);
    expect(getStreamKeyForJobType("article.extract")).toBe(ARTICLE_EXTRACTION_JOBS_STREAM_KEY);
  });

  test("parses article extraction jobs", () => {
    expect(
      parseJob({
        type: "article.extract",
        payload: JSON.stringify({
          articleId: "article-1",
          userId: "user-1",
          requestedAt: "2026-07-08T00:00:00.000Z",
        }),
      }),
    ).toEqual({
      type: "article.extract",
      payload: {
        articleId: "article-1",
        userId: "user-1",
        requestedAt: "2026-07-08T00:00:00.000Z",
      },
    });
  });

  test("normalizes stream trimming and bounded concurrency defaults", () => {
    expect(normalizeQueueOptions({}).streamMaxLength).toBe(100_000);
    expect(normalizeQueueOptions({ processConcurrency: 0 }).processConcurrency).toBe(1);
    expect(normalizeQueueOptions({ processConcurrency: 1_000 }).processConcurrency).toBe(64);
  });

  test("parses valid feed refresh generations and rejects malformed ones", () => {
    expect(
      parseJob({
        type: "feed.refresh",
        payload: JSON.stringify({ feedId: "feed-1", userId: "user-1", generation: 7 }),
      }).payload,
    ).toMatchObject({ generation: 7 });

    for (const generation of [-1, 1.5]) {
      expect(() =>
        parseJob({
          type: "feed.refresh",
          payload: JSON.stringify({ feedId: "feed-1", userId: "user-1", generation }),
        }),
      ).toThrow("Invalid feed.refresh payload");
    }
  });
});
