import { describe, expect, test } from "bun:test";
import {
  FEED_REFRESH_JOBS_STREAM_KEY,
  OPML_JOBS_STREAM_KEY,
  getStreamKeyForJobType,
  normalizeQueueOptions,
} from "@kyomi/worker";

describe("queue routing", () => {
  test("routes feed refresh jobs separately from OPML jobs", () => {
    expect(getStreamKeyForJobType("feed.refresh")).toBe(FEED_REFRESH_JOBS_STREAM_KEY);
    expect(getStreamKeyForJobType("opml.import")).toBe(OPML_JOBS_STREAM_KEY);
    expect(getStreamKeyForJobType("opml.import.feed")).toBe(OPML_JOBS_STREAM_KEY);
  });

  test("normalizes stream trimming and bounded concurrency defaults", () => {
    expect(normalizeQueueOptions({}).streamMaxLength).toBe(100_000);
    expect(normalizeQueueOptions({ processConcurrency: 0 }).processConcurrency).toBe(1);
    expect(normalizeQueueOptions({ processConcurrency: 1_000 }).processConcurrency).toBe(64);
  });
});
