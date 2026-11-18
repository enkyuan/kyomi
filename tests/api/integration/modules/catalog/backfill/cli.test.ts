import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { EMBEDDING_CLASSIFIER_MODEL_ID } from "@kyomi/ingest";
import { parseBackfillArgs, summarizeBackfill } from "@modules/catalog/backfill/cli";

const parse = (...flags: string[]) =>
  Effect.runPromise(parseBackfillArgs(["bun", "backfill", ...flags]));
/** The typed failure message of a parse that must be rejected. */
const rejection = (...flags: string[]) =>
  Effect.runPromise(
    Effect.flip(parseBackfillArgs(["bun", "backfill", ...flags])).pipe(
      Effect.map((error) => ({ tag: error._tag, message: error.message })),
    ),
  );

describe("category backfill arguments", () => {
  test("defaults to dry-run with capped item scans", async () => {
    expect(await parse()).toEqual({
      apply: false,
      all: false,
      limit: 500,
      batchSize: 1000,
      itemLimit: 50,
      feedId: null,
      classifier: "keyword",
      recentDays: null,
      normalizeExisting: false,
      retryFailed: false,
    });
  });

  test("parses apply, limit, item limit, feed id, classifier, and recent days", async () => {
    expect(
      await parse(
        "--apply",
        "--normalize-existing",
        "--retry-failed",
        "--limit",
        "25",
        "--batch-size",
        "1250",
        "--item-limit",
        "10",
        "--feed-id",
        "feed-1",
        "--classifier",
        "embedding",
        "--recent-days",
        "7",
        "--normalize-existing",
      ),
    ).toEqual({
      apply: true,
      all: false,
      limit: 25,
      batchSize: 1250,
      itemLimit: 10,
      feedId: "feed-1",
      classifier: "embedding",
      recentDays: 7,
      normalizeExisting: true,
      retryFailed: true,
    });

    expect((await parse("--embedding")).classifier).toBe("embedding");
    expect((await parse("--all-items")).itemLimit).toBeNull();
    expect(await parse("--all")).toMatchObject({ all: true, itemLimit: null, recentDays: null });
  });

  test("rejects malformed throttling flags instead of silently scanning too much", async () => {
    expect(await rejection("--item-limit", "abc")).toEqual({
      tag: "InvalidArguments",
      message: "Invalid --item-limit value: abc",
    });
    expect((await rejection("--item-limit", "0")).message).toBe("Invalid --item-limit value: 0");
    expect((await rejection("--item-limit", "-5")).message).toBe("Invalid --item-limit value: -5");
    expect((await rejection("--recent-days", "soon")).message).toBe(
      "Invalid --recent-days value: soon",
    );
    expect((await rejection("--recent-days", "0")).message).toBe("Invalid --recent-days value: 0");
    expect((await rejection("--all-items", "--item-limit", "50")).message).toBe(
      "--all-items cannot be combined with --item-limit",
    );
  });

  test("rejects --all combined with partial scans", async () => {
    expect((await rejection("--all", "--item-limit", "5")).message).toContain(
      "--all cannot be combined with --item-limit",
    );
    expect((await rejection("--all", "--recent-days", "5")).message).toContain(
      "--all cannot be combined with --recent-days",
    );
  });

  test("rejects malformed classifier flags", async () => {
    expect((await rejection("--classifier", "semantic")).message).toBe(
      "Invalid --classifier value: semantic",
    );
    expect((await rejection("--classifier", "keyword", "--embedding")).message).toBe(
      "--embedding cannot be combined with --classifier keyword",
    );
  });
});

describe("summarizeBackfill", () => {
  test("summarizes dry-run and apply output", () => {
    expect(
      summarizeBackfill({
        apply: false,
        classifierMethod: "keyword",
        classifierModelId: "keyword-v1",
        feedsScanned: 2,
        feedsWithClassifierCategories: 2,
        feedClassifierFallbacksSuppressed: 1,
        feedsFailed: 0,
        itemsScanned: 4,
        itemsWithClassifierCategories: 1,
        itemClassifierAbstentions: 3,
        itemEmbeddingFailures: 0,
        feedBackfillStatusesRecorded: 0,
        normalizedExistingAssignments: true,
        assignmentsScanned: 5,
        assignmentsRewritten: 2,
        assignmentsDroppedUnmapped: 1,
      }),
    ).toBe(
      "DRY RUN (keyword/keyword-v1): scanned 2 feeds and 4 items; would write classifier categories for 2 feeds and 1 items. " +
        "would rewrite 2 of 5 existing assignments to canonical categories and dropped 1 unmapped assignments. " +
        "Suppressed classifier feed fallback for 1 broad feeds; item classifier abstained on 3 items. " +
        "would write coverage status for 0 feeds; 0 feeds failed.",
    );

    expect(
      summarizeBackfill({
        apply: true,
        classifierMethod: "embedding",
        classifierModelId: EMBEDDING_CLASSIFIER_MODEL_ID,
        feedsScanned: 2,
        feedsWithClassifierCategories: 2,
        feedClassifierFallbacksSuppressed: 1,
        feedsFailed: 1,
        itemsScanned: 4,
        itemsWithClassifierCategories: 1,
        itemClassifierAbstentions: 3,
        itemEmbeddingFailures: 3,
        feedBackfillStatusesRecorded: 2,
        normalizedExistingAssignments: false,
        assignmentsScanned: 5,
        assignmentsRewritten: 2,
        assignmentsDroppedUnmapped: 1,
      }),
    ).toBe(
      `APPLIED (embedding/${EMBEDDING_CLASSIFIER_MODEL_ID}): scanned 2 feeds and 4 items; wrote classifier categories for 2 feeds and 1 items. ` +
        "Skipped existing assignment normalization. " +
        "Suppressed classifier feed fallback for 1 broad feeds; item classifier abstained on 3 items. " +
        "wrote coverage status for 2 feeds; 1 feed failed; 3 embedding failures.",
    );
  });
});
