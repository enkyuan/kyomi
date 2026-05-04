import type { db } from "@adapters/db/client";
import { articleClips, feedItemUserState, feedItems, feedSubscriptions, feeds } from "@cronos/db";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { articleIsReadSql } from "./sql";
import type { ArticleCountScope, ArticleCountsDto } from "../types";

type DB = typeof db;

export async function getArticleCountsForUser(
  database: DB,
  userId: string,
  scope?: ArticleCountScope,
): Promise<ArticleCountsDto> {
  const joinCond = and(
    eq(feedItems.feedId, feedSubscriptions.feedId),
    eq(feedSubscriptions.userId, userId),
  );
  const stateJoin = and(
    eq(feedItemUserState.feedItemId, feedItems.id),
    eq(feedItemUserState.userId, userId),
  );

  const scopedFeedId = scope?.feedId?.trim();
  const scopedFolderId = scope?.folderId?.trim();
  const feedScopeFilter =
    scopedFeedId || scopedFolderId
      ? and(
          scopedFeedId ? eq(feedItems.feedId, scopedFeedId) : undefined,
          scopedFolderId ? eq(feedSubscriptions.folderId, scopedFolderId) : undefined,
        )
      : undefined;

  const [unreadRow] = await database
    .select({ c: sql<number>`count(*)::int` })
    .from(feedItems)
    .innerJoin(feedSubscriptions, joinCond)
    .leftJoin(feedItemUserState, stateJoin)
    .where(and(sql`(${articleIsReadSql}) = false`, feedScopeFilter));

  const [allRow] = await database
    .select({ c: sql<number>`count(*)::int` })
    .from(feedItems)
    .innerJoin(feedSubscriptions, joinCond)
    .leftJoin(feedItemUserState, stateJoin)
    .where(feedScopeFilter);

  const [savedRow] = await database
    .select({ c: sql<number>`count(*)::int` })
    .from(feedItems)
    .innerJoin(feedSubscriptions, joinCond)
    .leftJoin(feedItemUserState, stateJoin)
    .where(and(sql`${feedItemUserState.isSaved} IS TRUE`, feedScopeFilter));

  const includeMergedClipSavedCount = !scopedFeedId && !scopedFolderId;
  const clipSaved = includeMergedClipSavedCount
    ? await database
        .select({ c: sql<number>`count(*)::int` })
        .from(articleClips)
        .where(and(eq(articleClips.userId, userId), eq(articleClips.isSaved, true)))
    : [];
  const clipSavedRow = clipSaved[0];

  return {
    all: allRow?.c ?? 0,
    unread: unreadRow?.c ?? 0,
    saved: (savedRow?.c ?? 0) + (clipSavedRow?.c ?? 0),
  };
}

/**
 * Counts subscribed feed articles whose `publishedAt` falls in `[publishedAfter, publishedBefore)`,
 * matching the date window used by `GET /articles` with the same query params (feeds source only).
 */
export async function countFeedArticlesPublishedInRange(
  database: DB,
  userId: string,
  publishedAfter: Date,
  publishedBefore: Date,
  scope?: ArticleCountScope,
): Promise<number> {
  const joinCond = and(
    eq(feedItems.feedId, feedSubscriptions.feedId),
    eq(feedSubscriptions.userId, userId),
  );

  const scopedFeedId = scope?.feedId?.trim();
  const scopedFolderId = scope?.folderId?.trim();

  const [row] = await database
    .select({ c: sql<number>`count(*)::int` })
    .from(feedItems)
    .innerJoin(feedSubscriptions, joinCond)
    .innerJoin(feeds, eq(feedItems.feedId, feeds.id))
    .where(
      and(
        gte(feedItems.publishedAt, publishedAfter),
        lt(feedItems.publishedAt, publishedBefore),
        scopedFeedId ? eq(feedItems.feedId, scopedFeedId) : undefined,
        scopedFolderId ? eq(feedSubscriptions.folderId, scopedFolderId) : undefined,
      ),
    );

  return row?.c ?? 0;
}

/**
 * Returns a map of feedId → unread article count for each of the supplied feed IDs.
 * Uses a single GROUP BY query so it scales to many feeds without N+1 requests.
 */
export async function getUnreadCountsPerFeed(
  database: DB,
  userId: string,
  feedIds: string[],
): Promise<Record<string, number>> {
  if (feedIds.length === 0) {
    return {};
  }

  const joinCond = and(
    eq(feedItems.feedId, feedSubscriptions.feedId),
    eq(feedSubscriptions.userId, userId),
  );
  const stateJoin = and(
    eq(feedItemUserState.feedItemId, feedItems.id),
    eq(feedItemUserState.userId, userId),
  );

  const rows = await database
    .select({
      feedId: feedItems.feedId,
      count: sql<number>`count(*)::int`,
    })
    .from(feedItems)
    .innerJoin(feedSubscriptions, joinCond)
    .leftJoin(feedItemUserState, stateJoin)
    .where(and(inArray(feedItems.feedId, feedIds), sql`(${articleIsReadSql}) = false`))
    .groupBy(feedItems.feedId);

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.feedId] = row.count;
  }
  // Ensure every requested feed ID has an entry (default 0 for feeds with no unread items)
  for (const id of feedIds) {
    if (!(id in result)) {
      result[id] = 0;
    }
  }
  return result;
}
