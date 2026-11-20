import { Effect, Result } from "effect";
import { syncInferredFeedCategories } from "@kyomi/ingest";
import { Db } from "@adapters/db/service";
import { failureMessage } from "../errors";
import { inferClassifierFeed, inferClassifierItems, syncsItemLabels } from "./infer";
import { loadItemsForFeeds, loadItemsPage, nextItemBackfillBatchSize } from "./queries";
import type { BackfillStatusRecord, ProcessedFeedBatchEntry } from "./store";
import {
  BACKFILL_STATUS_FAILED,
  type BackfillArgs,
  type BackfillClassifier,
  type BackfillFeedItemRecord,
  type BackfillFeedRecord,
  type BackfillItemRecord,
  type BackfillStats,
  type ProcessedFeedStats,
} from "./types";

export function createProcessedFeedStats(): ProcessedFeedStats {
  return {
    feedClassifierCategories: 0,
    feedClassifierFallbackSuppressed: false,
    itemsScanned: 0,
    itemsWithClassifierCategories: 0,
    itemClassifierAbstentions: 0,
  };
}

export function mergeProcessedFeedStats(stats: BackfillStats, feedStats: ProcessedFeedStats): void {
  if (feedStats.feedClassifierCategories > 0) {
    stats.feedsWithClassifierCategories += 1;
  }
  if (feedStats.feedClassifierFallbackSuppressed) {
    stats.feedClassifierFallbacksSuppressed += 1;
  }
  stats.itemsScanned += feedStats.itemsScanned;
  stats.itemsWithClassifierCategories += feedStats.itemsWithClassifierCategories;
  stats.itemClassifierAbstentions += feedStats.itemClassifierAbstentions;
}

/** Counts one inferred item into the feed's stats. */
function countInferredItem(feedStats: ProcessedFeedStats, labelCount: number): void {
  feedStats.itemsScanned += 1;
  if (labelCount > 0) {
    feedStats.itemsWithClassifierCategories += 1;
  } else {
    feedStats.itemClassifierAbstentions += 1;
  }
}

/** Classifies one feed and its items page by page, writing as it goes when `apply` is set. */
export const processFeed = Effect.fn("catalog.backfill.processFeed")(function* (
  feed: BackfillFeedRecord,
  args: BackfillArgs,
  classifier: BackfillClassifier,
  stats: BackfillStats,
  now: Date,
  feedStats: ProcessedFeedStats,
) {
  const db = yield* Db;
  const { categories: feedCategories, suppressedFallback } = yield* inferClassifierFeed(
    feed,
    classifier,
    stats,
  );
  feedStats.feedClassifierCategories = feedCategories.length;
  feedStats.feedClassifierFallbackSuppressed = suppressedFallback;

  let itemOffset = 0;
  let remainingItems = args.itemLimit ?? Number.POSITIVE_INFINITY;

  while (remainingItems > 0) {
    const batchSize = nextItemBackfillBatchSize({
      itemLimit: args.itemLimit,
      processed: itemOffset,
    });
    if (batchSize === null) {
      break;
    }
    const items = yield* loadItemsPage(feed.id, batchSize, itemOffset, args.recentDays);
    if (items.length === 0) {
      break;
    }

    const inferredItems = yield* inferClassifierItems(feed, items, classifier, stats);
    for (const { inferredCategoryLabels } of inferredItems) {
      countInferredItem(feedStats, inferredCategoryLabels.length);
    }
    const itemsById = new Map(items.map((item) => [item.id, item]));
    const syncedItems = inferredItems.filter(({ id, inferredCategoryLabels }) =>
      syncsItemLabels(itemsById.get(id)!, inferredCategoryLabels),
    );

    if (args.apply) {
      // syncInferredFeedCategories unconditionally deletes+reinserts the feed's
      // classifier-provenance feed_category_assignments rows on every call, so passing
      // the real feedCategories here would rewrite identical feed-level data once per
      // page. Item-level deletes ARE correctly scoped to this page's item ids, so only
      // the item sync needs to run per page; the feed-level sync happens once below.
      yield* db.use("catalog.backfill.syncItems", (client) =>
        syncInferredFeedCategories(
          client,
          { feedId: feed.id, feedCategories: [], items: syncedItems, model: classifier.model },
          now,
        ),
      );
    }

    itemOffset += items.length;
    if (Number.isFinite(remainingItems)) {
      remainingItems -= items.length;
    }
    if (items.length < batchSize) {
      break;
    }
  }

  if (args.apply) {
    // Single feed-level sync per feed, run last so no later per-page call can delete it.
    yield* db.use("catalog.backfill.syncFeed", (client) =>
      syncInferredFeedCategories(
        client,
        { feedId: feed.id, feedCategories, items: [], model: classifier.model },
        now,
      ),
    );
  }
});

/**
 * Classifies a batch of feeds from items loaded in one query. A feed that fails is returned as a
 * failed coverage row instead of failing the batch.
 */
export const processFeedBatch = Effect.fn("catalog.backfill.processBatch")(function* (
  feedRows: BackfillFeedRecord[],
  classifier: BackfillClassifier,
  stats: BackfillStats,
) {
  const items: BackfillFeedItemRecord[] = yield* loadItemsForFeeds(feedRows.map((feed) => feed.id));
  const itemsByFeedId = new Map<string, BackfillItemRecord[]>();
  for (const item of items) {
    const feedItems = itemsByFeedId.get(item.feedId);
    if (feedItems) {
      feedItems.push(item);
    } else {
      itemsByFeedId.set(item.feedId, [item]);
    }
  }

  const processed: ProcessedFeedBatchEntry[] = [];
  const failedStatuses: BackfillStatusRecord[] = [];

  for (const feed of feedRows) {
    const feedStats = createProcessedFeedStats();
    const outcome = yield* Effect.result(
      Effect.gen(function* () {
        const { categories: feedCategories, suppressedFallback } = yield* inferClassifierFeed(
          feed,
          classifier,
          stats,
        );
        feedStats.feedClassifierCategories = feedCategories.length;
        feedStats.feedClassifierFallbackSuppressed = suppressedFallback;

        const batchItems = itemsByFeedId.get(feed.id) ?? [];
        const batchItemsById = new Map(batchItems.map((item) => [item.id, item]));
        const inferredItems = (yield* inferClassifierItems(
          feed,
          batchItems,
          classifier,
          stats,
        )).map(({ id, inferredCategoryLabels }) => {
          countInferredItem(feedStats, inferredCategoryLabels.length);
          return { id, feedId: feed.id, inferredCategoryLabels };
        });
        return {
          feed,
          feedCategories,
          items: inferredItems.filter(({ id, inferredCategoryLabels }) =>
            syncsItemLabels(batchItemsById.get(id)!, inferredCategoryLabels),
          ),
          stats: feedStats,
        } satisfies ProcessedFeedBatchEntry;
      }),
    );
    if (Result.isSuccess(outcome)) {
      processed.push(outcome.success);
    } else {
      failedStatuses.push({
        feedId: feed.id,
        status: BACKFILL_STATUS_FAILED,
        stats: feedStats,
        errorMessage: failureMessage(outcome.failure),
      });
    }
  }

  return { processed, failedStatuses };
});
