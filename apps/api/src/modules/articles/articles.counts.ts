import type { db } from "@adapters/db/client";
import { articleClips, feedItemUserState, feedItems, feedSubscriptions } from "@cronos/db";
import { and, eq, sql } from "drizzle-orm";
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
