import { env } from "@config/env";
import type { db } from "@adapters/db/client";
import { feedItemUserState, feedItems, feedSubscriptions, feeds } from "@cronos/db";
import { runFeedRefresh } from "@cronos/feed-ingest";
import { and, desc, eq, gte, lt, or, sql, type SQL } from "drizzle-orm";
import { articleIsReadSql } from "./articles.sql-read";
import type { ArticleListItemDto, ArticlesCursorListResponseDto } from "./articles.types";

type DB = typeof db;

export type ListArticlesOptions = {
  feedId?: string;
  folderId?: string;
  isRead?: boolean;
  isSaved?: boolean;
  publishedAfter?: Date;
  publishedBefore?: Date;
  limit: number;
  cursor?: string;
  /** When listing a single feed’s first page and results are empty, run a remote refresh once. */
  autoRefreshEmpty?: boolean;
};

function baseJoins(userId: string) {
  return {
    feedSubscriptionsJoin: and(
      eq(feedItems.feedId, feedSubscriptions.feedId),
      eq(feedSubscriptions.userId, userId),
    ),
    userStateJoin: and(
      eq(feedItemUserState.feedItemId, feedItems.id),
      eq(feedItemUserState.userId, userId),
    ),
  };
}

export async function listArticlesForUser(
  database: DB,
  userId: string,
  opts: ListArticlesOptions,
): Promise<ArticlesCursorListResponseDto> {
  const limit = Math.min(Math.max(opts.limit, 1), 200);

  const rows = await listArticleRows(database, userId, opts, limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].id : null;

  if (
    opts.autoRefreshEmpty &&
    opts.feedId &&
    !opts.cursor &&
    page.length === 0 &&
    env.DATABASE_URL
  ) {
    const refreshed = await runFeedRefresh(env.DATABASE_URL, opts.feedId, {
      url: env.MEILI_URL ?? "",
      masterKey: env.MEILI_MASTER_KEY,
      indexUid: env.MEILI_INDEX_FEEDS,
    });
    if (refreshed.ok && refreshed.itemCount > 0) {
      return listArticlesForUser(database, userId, { ...opts, autoRefreshEmpty: false });
    }
  }

  const items: ArticleListItemDto[] = page.map((r) => ({
    id: r.id,
    title: r.title,
    link: r.link,
    summary: r.summary,
    publishedAt: r.publishedAt.toISOString(),
    feedId: r.feedId,
    feedTitle: r.feedTitle,
    isRead: r.isRead,
    isSaved: r.isSaved,
    articleType: "feed" as const,
  }));

  return { items, next_cursor: nextCursor, has_more: hasMore, total_count: null };
}

type RawRow = {
  id: string;
  title: string;
  link: string;
  summary: string | null;
  publishedAt: Date;
  feedId: string;
  feedTitle: string;
  isRead: boolean;
  isSaved: boolean;
};

async function listArticleRows(
  database: DB,
  userId: string,
  opts: ListArticlesOptions,
  take: number,
): Promise<RawRow[]> {
  const { feedSubscriptionsJoin, userStateJoin } = baseJoins(userId);

  const filters: SQL[] = [];
  if (opts.feedId) {
    filters.push(eq(feedItems.feedId, opts.feedId));
  }
  if (opts.folderId) {
    filters.push(eq(feedSubscriptions.folderId, opts.folderId));
  }
  if (opts.isRead === true) {
    filters.push(sql`(${articleIsReadSql}) = true`);
  } else if (opts.isRead === false) {
    filters.push(sql`(${articleIsReadSql}) = false`);
  }
  if (opts.isSaved === true) {
    filters.push(sql`${feedItemUserState.isSaved} IS TRUE`);
  }
  if (opts.publishedAfter) {
    filters.push(gte(feedItems.publishedAt, opts.publishedAfter));
  }
  if (opts.publishedBefore) {
    filters.push(lt(feedItems.publishedAt, opts.publishedBefore));
  }

  if (opts.cursor) {
    const cur = await database
      .select({
        publishedAt: feedItems.publishedAt,
        id: feedItems.id,
      })
      .from(feedItems)
      .innerJoin(feedSubscriptions, feedSubscriptionsJoin)
      .where(
        and(
          eq(feedItems.id, opts.cursor),
          eq(feedSubscriptions.userId, userId),
          opts.folderId ? eq(feedSubscriptions.folderId, opts.folderId) : undefined,
        ),
      )
      .limit(1);
    const c = cur[0];
    if (c) {
      filters.push(
        or(
          lt(feedItems.publishedAt, c.publishedAt),
          and(eq(feedItems.publishedAt, c.publishedAt), lt(feedItems.id, c.id)),
        )!,
      );
    }
  }

  return database
    .select({
      id: feedItems.id,
      title: feedItems.title,
      link: feedItems.link,
      summary: feedItems.summary,
      publishedAt: feedItems.publishedAt,
      feedId: feedItems.feedId,
      feedTitle: feeds.title,
      isRead: articleIsReadSql,
      isSaved: sql<boolean>`COALESCE(${feedItemUserState.isSaved}, false)`,
    })
    .from(feedItems)
    .innerJoin(feedSubscriptions, feedSubscriptionsJoin)
    .innerJoin(feeds, eq(feedItems.feedId, feeds.id))
    .leftJoin(feedItemUserState, userStateJoin)
    .where(filters.length > 0 ? and(...filters) : sql`true`)
    .orderBy(desc(feedItems.publishedAt), desc(feedItems.id))
    .limit(take);
}
