import { Effect } from "effect";
import { valueAfter } from "@shared/cli/args";
import { positiveInt, strictPositiveIntFlag } from "../args";
import { InvalidArguments } from "../errors";
import type { BackfillArgs, BackfillClassifierMethod, BackfillStats } from "./types";

const DEFAULT_FEED_LIMIT = 500;
const DEFAULT_FEED_BATCH_SIZE = 1000;
const DEFAULT_ITEM_LIMIT = 50;

const parseClassifier = Effect.fn("catalog.backfill.classifierFlag")(function* (
  argv: readonly string[],
) {
  const value = valueAfter(argv, "--classifier");
  const shorthand = argv.includes("--embedding");
  if (shorthand && value && value !== "embedding") {
    return yield* new InvalidArguments({
      message: "--embedding cannot be combined with --classifier keyword",
    });
  }
  if (shorthand) {
    return "embedding" satisfies BackfillClassifierMethod;
  }
  if (!value) {
    return "keyword" satisfies BackfillClassifierMethod;
  }
  if (value === "keyword" || value === "embedding") {
    return value;
  }
  return yield* new InvalidArguments({ message: `Invalid --classifier value: ${value}` });
});

const parseItemLimit = Effect.fn("catalog.backfill.itemLimitFlag")(function* (
  argv: readonly string[],
) {
  const allItems = argv.includes("--all-items");
  const itemLimit = yield* strictPositiveIntFlag(argv, "--item-limit");
  if (allItems && itemLimit !== null) {
    return yield* new InvalidArguments({
      message: "--all-items cannot be combined with --item-limit",
    });
  }
  return allItems ? null : (itemLimit ?? DEFAULT_ITEM_LIMIT);
});

/** Parses the `category:backfill` flags; a malformed or contradictory flag fails the run. */
export const parseBackfillArgs = Effect.fn("catalog.backfill.parseArgs")(function* (
  argv: readonly string[],
) {
  const all = argv.includes("--all");
  const itemLimit = yield* strictPositiveIntFlag(argv, "--item-limit");
  const recentDays = yield* strictPositiveIntFlag(argv, "--recent-days");
  if (all && itemLimit !== null) {
    return yield* new InvalidArguments({
      message: "--all cannot be combined with --item-limit; coverage requires full item scans",
    });
  }
  if (all && recentDays !== null) {
    return yield* new InvalidArguments({
      message: "--all cannot be combined with --recent-days; coverage requires full item scans",
    });
  }
  const args: BackfillArgs = {
    apply: argv.includes("--apply"),
    all,
    limit: positiveInt(valueAfter(argv, "--limit"), DEFAULT_FEED_LIMIT),
    batchSize: positiveInt(valueAfter(argv, "--batch-size"), DEFAULT_FEED_BATCH_SIZE),
    itemLimit: all ? null : yield* parseItemLimit(argv),
    feedId: valueAfter(argv, "--feed-id"),
    classifier: yield* parseClassifier(argv),
    recentDays,
    normalizeExisting: argv.includes("--normalize-existing"),
    retryFailed: argv.includes("--retry-failed"),
  };
  return args;
});

function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

export function summarizeBackfill(stats: BackfillStats): string {
  const action = stats.apply ? "APPLIED" : "DRY RUN";
  const verb = stats.apply ? "wrote" : "would write";
  const assignmentVerb = stats.apply ? "rewrote" : "would rewrite";
  const coverageVerb = stats.apply ? "wrote" : "would write";
  const assignmentSummary = stats.normalizedExistingAssignments
    ? `${assignmentVerb} ${stats.assignmentsRewritten} of ${stats.assignmentsScanned} existing assignments to canonical categories and dropped ${stats.assignmentsDroppedUnmapped} unmapped assignments.`
    : "Skipped existing assignment normalization.";
  return (
    `${action} (${stats.classifierMethod}/${stats.classifierModelId}): scanned ${stats.feedsScanned} feeds and ${stats.itemsScanned} items; ${verb} classifier categories for ${stats.feedsWithClassifierCategories} feeds and ${stats.itemsWithClassifierCategories} items. ` +
    `${assignmentSummary} ` +
    `Suppressed classifier feed fallback for ${stats.feedClassifierFallbacksSuppressed} broad feeds; item classifier abstained on ${stats.itemClassifierAbstentions} items. ` +
    `${coverageVerb} coverage status for ${pluralize(stats.feedBackfillStatusesRecorded, "feed")}; ${pluralize(stats.feedsFailed, "feed")} failed` +
    (stats.itemEmbeddingFailures > 0
      ? `; ${pluralize(stats.itemEmbeddingFailures, "embedding failure")}.`
      : ".")
  );
}
