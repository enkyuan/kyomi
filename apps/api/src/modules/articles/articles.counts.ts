import type { db } from "@adapters/db/client";
import { articleClips, feedItemUserState, feedItems, feedSubscriptions } from "@cronos/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { articleIsReadSql } from "./articles.sql-read";
import type { ArticleCountsDto } from "./articles.types";

type DB = typeof db;

export async function getArticleCountsForUser(
  database: DB,
  userId: string,
): Promise<ArticleCountsDto> {
  const joinCond = and(
    eq(feedItems.feedId, feedSubscriptions.feedId),
    eq(feedSubscriptions.userId, userId),
  );
  const stateJoin = and(
    eq(feedItemUserState.feedItemId, feedItems.id),
    eq(feedItemUserState.userId, userId),
  );

  const [unreadRow] = await database
    .select({ c: sql<number>`count(*)::int` })
    .from(feedItems)
    .innerJoin(feedSubscriptions, joinCond)
    .leftJoin(feedItemUserState, stateJoin)
    .where(sql`(${articleIsReadSql}) = false`);

  const [savedRow] = await database
    .select({ c: sql<number>`count(*)::int` })
    .from(feedItems)
    .innerJoin(feedSubscriptions, joinCond)
    .leftJoin(feedItemUserState, stateJoin)
    .where(sql`${feedItemUserState.isSaved} IS TRUE`);

  const [clipUnreadRow] = await database
    .select({ c: sql<number>`count(*)::int` })
    .from(articleClips)
    .where(and(eq(articleClips.userId, userId), eq(articleClips.isRead, false)));

  const [clipSavedRow] = await database
    .select({ c: sql<number>`count(*)::int` })
    .from(articleClips)
    .where(and(eq(articleClips.userId, userId), eq(articleClips.isSaved, true)));

  return {
    unread: (unreadRow?.c ?? 0) + (clipUnreadRow?.c ?? 0),
    saved: (savedRow?.c ?? 0) + (clipSavedRow?.c ?? 0),
  };
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
    .where(
      and(
        inArray(feedItems.feedId, feedIds),
        sql`(${articleIsReadSql}) = false`,
      ),
    )
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
