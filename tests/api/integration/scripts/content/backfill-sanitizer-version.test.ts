import { describe, expect, test } from "bun:test";
import { ARTICLE_HTML_SANITIZER_VERSION } from "@kyomi/worker/sanitization";
import {
  parseBackfillSanitizerVersionArgs,
  processSanitizerVersionRow,
} from "../../../../../scripts/content/backfill-sanitizer-version";

describe("backfill-sanitizer-version arg parsing", () => {
  test("defaults to dry-run, batch 100, sleep 100ms, all five scopes", () => {
    expect(parseBackfillSanitizerVersionArgs(["bun", "backfill"])).toEqual({
      apply: false,
      batchSize: 100,
      sleepMs: 100,
      scopes: [
        "feed-original",
        "feed-extracted",
        "clip-original",
        "clip-extracted",
        "extraction-cache",
      ],
    });
  });

  test("parses --apply, --batch-size, --sleep-ms, and repeated --scope", () => {
    expect(
      parseBackfillSanitizerVersionArgs([
        "bun",
        "backfill",
        "--apply",
        "--batch-size",
        "250",
        "--sleep-ms",
        "500",
        "--scope",
        "feed-original",
        "--scope",
        "clip-extracted",
      ]),
    ).toEqual({
      apply: true,
      batchSize: 250,
      sleepMs: 500,
      scopes: ["feed-original", "clip-extracted"],
    });
  });

  test("rejects an out-of-range batch size", () => {
    expect(() =>
      parseBackfillSanitizerVersionArgs(["bun", "backfill", "--batch-size", "0"]),
    ).toThrow();
    expect(() =>
      parseBackfillSanitizerVersionArgs(["bun", "backfill", "--batch-size", "501"]),
    ).toThrow();
  });

  test("rejects an out-of-range sleep", () => {
    expect(() =>
      parseBackfillSanitizerVersionArgs(["bun", "backfill", "--sleep-ms", "-1"]),
    ).toThrow();
    expect(() =>
      parseBackfillSanitizerVersionArgs(["bun", "backfill", "--sleep-ms", "10001"]),
    ).toThrow();
  });

  test("rejects a non-numeric batch size or sleep", () => {
    expect(() =>
      parseBackfillSanitizerVersionArgs(["bun", "backfill", "--batch-size", "abc"]),
    ).toThrow();
    expect(() =>
      parseBackfillSanitizerVersionArgs(["bun", "backfill", "--sleep-ms", "abc"]),
    ).toThrow();
  });

  test("rejects an invalid scope", () => {
    expect(() =>
      parseBackfillSanitizerVersionArgs(["bun", "backfill", "--scope", "not-a-scope"]),
    ).toThrow();
  });
});

describe("processSanitizerVersionRow", () => {
  test("skips a row already at the current version", () => {
    const result = processSanitizerVersionRow({
      html: "<p>Already clean.</p>",
      sanitizerVersion: ARTICLE_HTML_SANITIZER_VERSION,
    });
    expect(result.skipped).toBe(true);
  });

  test("processes a null-version row and returns bounded sanitized output", () => {
    const result = processSanitizerVersionRow({
      html: '<p onclick="alert(1)">Dirty</p>',
      sanitizerVersion: null,
    });
    expect(result.skipped).toBe(false);
    expect(result.html).not.toContain("onclick");
    expect(result.sanitizerVersion).toBe(ARTICLE_HTML_SANITIZER_VERSION);
    expect(typeof result.text).toBe("string");
  });

  test("processes an old-version row", () => {
    const result = processSanitizerVersionRow({
      html: '<p onclick="alert(1)">Dirty</p>',
      sanitizerVersion: "article-html-v0",
    });
    expect(result.skipped).toBe(false);
    expect(result.html).not.toContain("onclick");
  });
});
