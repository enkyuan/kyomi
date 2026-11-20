import { Effect } from "effect";
import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { feedCategoryBackfillStatus, feedItems, feeds } from "@kyomi/db";
import { Db, type Database } from "@adapters/db/service";
import {
  BACKFILL_STATUS_FAILED,
  type BackfillArgs,
  type BackfillClassifier,
  type BackfillFeedRecord,
} from "./types";

const ITEM_BACKFILL_BATCH_SIZE = 500;

const feedColumns = {
  id: feeds.id,
  title: feeds.title,
  description: feeds.description,
  url: feeds.url,
  link: feeds.link,
  sourceKind: feeds.sourceKind,
};

/**
 * Item columns both loaders select. Extracted text is read only once extraction finished, so
 * backfill classifies from the same text extraction re-classification used instead of
 * overwriting its labels from the thinner feed text.
 */
export const backfillItemColumns = {
  title: feedItems.title,
  summary: feedItems.summary,
  contentText: feedItems.contentText,
  extractedContentText: sql<string | null>`
    CASE WHEN ${feedItems.extractedContentStatus} = 'ready' THEN ${feedItems.extractedContentText} END
  `,
  link: feedItems.link,
  canonicalUrl: feedItems.canonicalUrl,
};

const recentlyPublished = (recentDays: number) =>
  sql`${feedItems.publishedAt} >= now() - (${recentDays}::int * interval '1 day')`;

function feedsQuery(client: Database, args: BackfillArgs) {
  if (args.recentDays) {
    const recentFeedItems = client
      .select({
        feedId: feedItems.feedId,
        latestPublishedAt: sql<Date>`max(${feedItems.publishedAt})`.as("latest_published_at"),
      })
      .from(feedItems)
      .where(recentlyPublished(args.recentDays))
      .groupBy(feedItems.feedId)
      .as("recent_feed_items");

    const recentFeeds = client
      .select(feedColumns)
      .from(feeds)
      .innerJoin(recentFeedItems, eq(feeds.id, recentFeedItems.feedId));
    return (args.feedId ? recentFeeds.where(eq(feeds.id, args.feedId)) : recentFeeds)
      .orderBy(desc(recentFeedItems.latestPublishedAt), feeds.id)
      .limit(args.limit);
  }

  const allFeeds = client.select(feedColumns).from(feeds);
  return (args.feedId ? allFeeds.where(eq(feeds.id, args.feedId)) : allFeeds)
    .orderBy(feeds.id)
    .limit(args.limit);
}

/** Feeds without a coverage row for this classifier model (or with a failed one, to retry). */
function uncoveredFeedsPageQuery(
  client: Database,
  args: BackfillArgs,
  classifier: BackfillClassifier,
  cursorFeedId: string | null,
) {
  const statusJoin = and(
    eq(feedCategoryBackfillStatus.feedId, feeds.id),
    eq(feedCategoryBackfillStatus.classifierMethod, classifier.model.classifierMethod),
    eq(feedCategoryBackfillStatus.modelId, classifier.model.modelId),
    eq(feedCategoryBackfillStatus.taxonomyVersion, classifier.model.taxonomyVersion),
  );
  const statusFilter = args.retryFailed
    ? or(
        isNull(feedCategoryBackfillStatus.feedId),
        eq(feedCategoryBackfillStatus.status, BACKFILL_STATUS_FAILED),
      )
    : isNull(feedCategoryBackfillStatus.feedId);
  const whereClause = cursorFeedId ? and(gt(feeds.id, cursorFeedId), statusFilter) : statusFilter;

  return client
    .select(feedColumns)
    .from(feeds)
    .leftJoin(feedCategoryBackfillStatus, statusJoin)
    .where(whereClause)
    .orderBy(feeds.id)
    .limit(args.batchSize);
}

/** The next page of feeds to process: coverage pages in `--all` mode, the capped list otherwise. */
export const loadNextFeedBatch = Effect.fn("catalog.backfill.loadFeeds")(function* (
  args: BackfillArgs,
  classifier: BackfillClassifier,
  cursorFeedId: string | null,
) {
  const db = yield* Db;
  const rows: BackfillFeedRecord[] = yield* db.use("catalog.backfill.loadFeeds", async (client) =>
    args.all && !args.feedId
      ? uncoveredFeedsPageQuery(client, args, classifier, cursorFeedId)
      : feedsQuery(client, args),
  );
  return rows;
});

/** One page of a feed's items, newest first. */
export const loadItemsPage = Effect.fn("catalog.backfill.loadItems")(function* (
  feedId: string,
  limit: number,
  offset: number,
  recentDays: number | null,
) {
  const db = yield* Db;
  const feedFilter = eq(feedItems.feedId, feedId);
  return yield* db.use("catalog.backfill.loadItems", async (client) =>
    client
      .select({ id: feedItems.id, ...backfillItemColumns })
      .from(feedItems)
      .where(recentDays ? and(feedFilter, recentlyPublished(recentDays)) : feedFilter)
      .orderBy(desc(feedItems.publishedAt), desc(feedItems.id))
      .limit(limit)
      .offset(offset),
  );
});

/** Every item of the given feeds, grouped by feed id. */
export const loadItemsForFeeds = Effect.fn("catalog.backfill.loadFeedBatchItems")(function* (
  feedIds: readonly string[],
) {
  if (feedIds.length === 0) {
    return [];
  }
  const db = yield* Db;
  return yield* db.use("catalog.backfill.loadFeedBatchItems", async (client) =>
    client
      .select({ id: feedItems.id, feedId: feedItems.feedId, ...backfillItemColumns })
      .from(feedItems)
      .where(inArray(feedItems.feedId, [...feedIds]))
      .orderBy(feedItems.feedId, desc(feedItems.publishedAt), desc(feedItems.id)),
  );
});

/** The next items-page size under an optional item limit, or null once the limit is reached. */
export function nextItemBackfillBatchSize(input: {
  itemLimit: number | null;
  processed: number;
}): number | null {
  if (input.itemLimit === null) {
    return ITEM_BACKFILL_BATCH_SIZE;
  }
  const remaining = input.itemLimit - input.processed;
  if (remaining <= 0) {
    return null;
  }
  return Math.min(ITEM_BACKFILL_BATCH_SIZE, remaining);
}
