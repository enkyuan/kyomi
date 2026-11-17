import { Effect, Result } from "effect";
import { AppLogger } from "@adapters/logger/service";
import { currentDate } from "../clock";
import { failureMessage } from "../errors";
import {
  createProcessedFeedStats,
  mergeProcessedFeedStats,
  processFeed,
  processFeedBatch,
} from "./feed";
import { resolveBackfillClassifier } from "./infer";
import { normalizeExistingAssignments } from "./normalize";
import { loadNextFeedBatch } from "./queries";
import {
  recordFeedBackfillStatuses,
  syncInferredFeedBatch,
  type BackfillStatusRecord,
} from "./store";
import {
  BACKFILL_STATUS_FAILED,
  BACKFILL_STATUS_PROCESSED,
  type BackfillArgs,
  type BackfillClassifier,
  type BackfillFeedRecord,
  type BackfillStats,
} from "./types";

const PROGRESS_INTERVAL = 10_000;

/** Coverage rows only describe full scans: a capped or recent-only run says nothing about coverage. */
function shouldTrackBackfillStatus(args: BackfillArgs): boolean {
  return args.itemLimit === null && args.recentDays === null;
}

function shouldUseBatchBackfill(args: BackfillArgs): boolean {
  return args.all && !args.feedId && args.itemLimit === null && args.recentDays === null;
}

type RunContext = {
  readonly args: BackfillArgs;
  readonly classifier: BackfillClassifier;
  readonly stats: BackfillStats;
  readonly now: Date;
};

/** One `--all` page: every feed's items load together and the results are written in bulk. */
const backfillFeedBatch = Effect.fn("catalog.backfill.feedBatch")(function* (
  feedRows: BackfillFeedRecord[],
  { args, classifier, stats, now }: RunContext,
) {
  stats.feedsScanned += feedRows.length;
  const { processed, failedStatuses } = yield* processFeedBatch(feedRows, classifier, stats);
  if (args.apply) {
    yield* syncInferredFeedBatch(processed, classifier, now);
  }
  for (const entry of processed) {
    mergeProcessedFeedStats(stats, entry.stats);
  }
  for (const failedStatus of failedStatuses) {
    mergeProcessedFeedStats(stats, failedStatus.stats);
  }
  stats.feedsFailed += failedStatuses.length;

  if (shouldTrackBackfillStatus(args)) {
    const statusRecords: BackfillStatusRecord[] = [
      ...processed.map<BackfillStatusRecord>((entry) => ({
        feedId: entry.feed.id,
        status: BACKFILL_STATUS_PROCESSED,
        stats: entry.stats,
        errorMessage: null,
      })),
      ...failedStatuses,
    ];
    if (args.apply) {
      yield* recordFeedBackfillStatuses(statusRecords, classifier, now);
    }
    stats.feedBackfillStatusesRecorded += statusRecords.length;
  }
});

/** Records one feed's coverage row (when this run tracks coverage) and counts it. */
const recordFeedStatus = Effect.fn("catalog.backfill.recordFeedStatus")(function* (
  record: BackfillStatusRecord,
  { args, classifier, stats, now }: RunContext,
) {
  if (!shouldTrackBackfillStatus(args)) {
    return;
  }
  if (args.apply) {
    yield* recordFeedBackfillStatuses([record], classifier, now);
  }
  stats.feedBackfillStatusesRecorded += 1;
});

/**
 * The one-feed-at-a-time path. A failed feed is recorded as failed and the run continues under
 * `--all`; otherwise the failure ends the run.
 */
const backfillFeeds = Effect.fn("catalog.backfill.feeds")(function* (
  feedRows: BackfillFeedRecord[],
  context: RunContext,
) {
  const { args, classifier, stats, now } = context;
  for (const feed of feedRows) {
    stats.feedsScanned += 1;
    const feedStats = createProcessedFeedStats();
    const processing = yield* Effect.result(
      processFeed(feed, args, classifier, stats, now, feedStats),
    );
    mergeProcessedFeedStats(stats, feedStats);
    // A failure to record the coverage row counts as the feed failing, as it always has.
    const outcome = Result.isSuccess(processing)
      ? yield* Effect.result(
          recordFeedStatus(
            {
              feedId: feed.id,
              status: BACKFILL_STATUS_PROCESSED,
              stats: feedStats,
              errorMessage: null,
            },
            context,
          ),
        )
      : processing;
    if (Result.isFailure(outcome)) {
      stats.feedsFailed += 1;
      yield* recordFeedStatus(
        {
          feedId: feed.id,
          status: BACKFILL_STATUS_FAILED,
          stats: feedStats,
          errorMessage: failureMessage(outcome.failure),
        },
        context,
      );
      if (!args.all) {
        return yield* Effect.fail(outcome.failure);
      }
    }
  }
});

/**
 * `category:backfill`: classifies feeds and their items with the keyword or embedding classifier
 * and, with `apply`, replaces the classifier rows and records coverage.
 */
export const runCategoryBackfill = Effect.fn("catalog.backfill.run")(function* (
  args: BackfillArgs,
) {
  const log = yield* AppLogger;
  const classifier = yield* resolveBackfillClassifier(args);
  const stats: BackfillStats = {
    apply: args.apply,
    classifierMethod: classifier.method,
    classifierModelId: classifier.model.modelId,
    feedsScanned: 0,
    feedsWithClassifierCategories: 0,
    feedClassifierFallbacksSuppressed: 0,
    feedsFailed: 0,
    itemsScanned: 0,
    itemsWithClassifierCategories: 0,
    itemClassifierAbstentions: 0,
    feedBackfillStatusesRecorded: 0,
    normalizedExistingAssignments: args.normalizeExisting,
    assignmentsScanned: 0,
    assignmentsRewritten: 0,
    assignmentsDroppedUnmapped: 0,
    itemEmbeddingFailures: 0,
  };
  const now = yield* currentDate;
  const context: RunContext = { args, classifier, stats, now };

  if (args.normalizeExisting) {
    const assignmentPlan = yield* normalizeExistingAssignments(args.apply, now);
    stats.assignmentsScanned = assignmentPlan.scanned;
    stats.assignmentsRewritten = assignmentPlan.rewritten;
    stats.assignmentsDroppedUnmapped = assignmentPlan.droppedUnmapped;
  }

  const useBatchBackfill = shouldUseBatchBackfill(args);
  let cursorFeedId: string | null = null;
  let lastProgressAt = 0;

  while (true) {
    const feedRows: BackfillFeedRecord[] = yield* loadNextFeedBatch(args, classifier, cursorFeedId);
    if (feedRows.length === 0) {
      break;
    }
    if (args.all && !args.feedId) {
      cursorFeedId = feedRows[feedRows.length - 1]!.id;
    }

    if (useBatchBackfill) {
      yield* backfillFeedBatch(feedRows, context);
      if (stats.feedsScanned - lastProgressAt >= PROGRESS_INTERVAL) {
        lastProgressAt = stats.feedsScanned;
        yield* log.info("catalog.backfill.progress", {
          feedsScanned: stats.feedsScanned,
          itemsScanned: stats.itemsScanned,
          coverageRowsRecorded: stats.feedBackfillStatusesRecorded,
        });
      }
      if (feedRows.length < args.batchSize) {
        break;
      }
      continue;
    }

    yield* backfillFeeds(feedRows, context);
    if (!args.all || args.feedId || feedRows.length < args.batchSize) {
      break;
    }
  }

  return stats;
});
