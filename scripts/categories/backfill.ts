import { desc, eq } from "drizzle-orm";
import { feedItems, feeds } from "../../packages/db/src";
import { db, pool } from "../../apps/api/src/adapters/db/client";
import { assertApiDatabaseReady } from "../../apps/api/src/adapters/db/script-preflight";
import {
  classifyFeedCategories,
  classifyFeedItemCategories,
  isMixedFeedHost,
  syncInferredFeedCategories,
  type InferredCategoryLabel,
} from "../../packages/worker/src";

export type BackfillArgs = {
  apply: boolean;
  limit: number;
  itemLimit: number;
  feedId: string | null;
};

export type BackfillStats = {
  apply: boolean;
  feedsScanned: number;
  feedsWithClassifierCategories: number;
  itemsScanned: number;
  itemsWithClassifierCategories: number;
};

function valueAfter(argv: string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return null;
  }
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function positiveInt(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseBackfillArgs(argv: string[]): BackfillArgs {
  return {
    apply: argv.includes("--apply"),
    limit: positiveInt(valueAfter(argv, "--limit"), 500),
    itemLimit: positiveInt(valueAfter(argv, "--item-limit"), 50),
    feedId: valueAfter(argv, "--feed-id"),
  };
}

export function summarizeBackfill(stats: BackfillStats): string {
  const action = stats.apply ? "APPLIED" : "DRY RUN";
  const verb = stats.apply ? "wrote" : "would write";
  return `${action}: scanned ${stats.feedsScanned} feeds and ${stats.itemsScanned} items; ${verb} classifier categories for ${stats.feedsWithClassifierCategories} feeds and ${stats.itemsWithClassifierCategories} items.`;
}

function loadFeeds(args: BackfillArgs) {
  const columns = {
    id: feeds.id,
    title: feeds.title,
    description: feeds.description,
    url: feeds.url,
    link: feeds.link,
    sourceKind: feeds.sourceKind,
  };

  if (!args.feedId) {
    return db.select(columns).from(feeds).orderBy(feeds.id).limit(args.limit);
  }

  return db
    .select(columns)
    .from(feeds)
    .where(eq(feeds.id, args.feedId))
    .orderBy(feeds.id)
    .limit(args.limit);
}

function loadRecentItems(feedId: string, limit: number) {
  return db
    .select({
      id: feedItems.id,
      title: feedItems.title,
      summary: feedItems.summary,
      link: feedItems.link,
      canonicalUrl: feedItems.canonicalUrl,
    })
    .from(feedItems)
    .where(eq(feedItems.feedId, feedId))
    .orderBy(desc(feedItems.publishedAt), desc(feedItems.id))
    .limit(limit);
}

export async function runCategoryBackfill(args: BackfillArgs): Promise<BackfillStats> {
  const stats: BackfillStats = {
    apply: args.apply,
    feedsScanned: 0,
    feedsWithClassifierCategories: 0,
    itemsScanned: 0,
    itemsWithClassifierCategories: 0,
  };

  const feedRows = await loadFeeds(args);
  const now = new Date();

  for (const feed of feedRows) {
    stats.feedsScanned += 1;
    const feedCategories = classifyFeedCategories({
      feedTitle: feed.title,
      feedDescription: feed.description,
      feedUrl: feed.url,
      feedSiteUrl: feed.link,
      sourceKind: feed.sourceKind,
    }).categories;
    if (feedCategories.length > 0) {
      stats.feedsWithClassifierCategories += 1;
    }

    const mixedFeed = isMixedFeedHost(feed.url) || isMixedFeedHost(feed.link);
    const items = await loadRecentItems(feed.id, args.itemLimit);
    const inferredItems = items.map((item) => {
      stats.itemsScanned += 1;
      const inferredCategoryLabels: InferredCategoryLabel[] = mixedFeed
        ? classifyFeedItemCategories({
            feedTitle: feed.title,
            feedDescription: feed.description,
            feedUrl: feed.url,
            feedSiteUrl: feed.link,
            sourceKind: feed.sourceKind,
            itemTitle: item.title,
            itemSummary: item.summary,
            itemUrl: item.link || item.canonicalUrl,
          }).categories
        : [];
      if (inferredCategoryLabels.length > 0) {
        stats.itemsWithClassifierCategories += 1;
      }
      return { id: item.id, inferredCategoryLabels };
    });

    if (args.apply) {
      await syncInferredFeedCategories(
        db,
        {
          feedId: feed.id,
          feedCategories,
          items: inferredItems,
        },
        now,
      );
    }
  }

  return stats;
}

if (import.meta.main) {
  const args = parseBackfillArgs(process.argv);
  try {
    await assertApiDatabaseReady({
      commandName: "categories:backfill",
      ensureSchema: true,
    });
    const stats = await runCategoryBackfill(args);
    console.log(summarizeBackfill(stats));
  } finally {
    await pool.end();
  }
}
