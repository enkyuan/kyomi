import { describe, expect, test } from "bun:test";
import { ARTICLE_HTML_SANITIZER_VERSION } from "@kyomi/worker/sanitization";
import {
  BACKFILL_SCOPES,
  parseBackfillSanitizerVersionArgs,
  processSanitizerVersionRow,
  runSanitizerVersionBackfillScope,
} from "../../../../../apps/api/src/app/boot/sanitizer";

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

describe("sanitizer backfill base URLs", () => {
  test("processSanitizerVersionRow resolves relative URLs and drops forged hints", () => {
    const result = processSanitizerVersionRow({
      html: '<p data-kyomi-url="https://evil.example/">See <a href="../about">about</a> <img src="img/a.png" alt=""></p>',
      sanitizerVersion: null,
      baseUrl: "https://example.com/posts/entry",
    });

    expect(result).toMatchObject({ skipped: false, failed: false });
    const html = "html" in result ? result.html : "";
    expect(html).toContain('href="https://example.com/about"');
    expect(html).toContain('src="https://example.com/posts/img/a.png"');
    expect(html).not.toContain("data-kyomi");
  });

  test("each scope passes the row's article URL to the reprocessing step", async () => {
    const rows = [
      {
        id: "item-1",
        html: '<p><a href="/next">Next</a></p>',
        sanitizerVersion: null,
        baseUrl: "https://example.com/posts/one",
      },
    ];
    const updates: Record<string, unknown>[] = [];
    let selected: Record<string, unknown> | null = null;
    const page = (result: unknown[]) => ({
      from: () => ({
        where: () => ({ orderBy: () => ({ limit: () => Promise.resolve(result) }) }),
      }),
    });
    let served = false;
    const database = {
      select: (fields: Record<string, unknown>) => {
        selected = fields;
        const result = served ? [] : rows;
        served = true;
        return page(result);
      },
      update: () => ({
        set: (patch: Record<string, unknown>) => {
          updates.push(patch);
          return { where: () => Promise.resolve() };
        },
      }),
    };

    for (const scope of BACKFILL_SCOPES) {
      served = false;
      updates.length = 0;
      await runSanitizerVersionBackfillScope(database as never, scope, {
        apply: true,
        batchSize: 10,
        sleepMs: 0,
      });

      expect(Object.keys(selected ?? {})).toContain("baseUrl");
      const html = String(updates[0]?.contentHtml ?? updates[0]?.extractedContentHtml);
      expect(html).toContain('href="https://example.com/next"');
    }
  });
});
