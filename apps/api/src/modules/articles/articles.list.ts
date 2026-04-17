import type { db } from "@adapters/db/client";
import { feedItemUserState, feedItems, feedSubscriptions, feeds } from "@cronos/db";
import { and, desc, eq, gte, lt, or, sql, type SQL } from "drizzle-orm";
import { decodeNullableText, decodeText } from "@shared/text/html-entities";
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

function normalizeLimit(limit: number): number {
  return Math.min(Math.max(limit, 1), 200);
}

function paginateRows(rows: RawRow[], limit: number) {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].id : null;
  return { hasMore, page, nextCursor };
}

function toArticleListItems(page: RawRow[]): ArticleListItemDto[] {
  return page.map((r) => ({
    id: r.id,
    title: decodeText(r.title),
    link: r.link,
    summary: decodeNullableText(r.summary),
    publishedAt: r.publishedAt.toISOString(),
    feedId: r.feedId,
    feedTitle: decodeText(r.feedTitle),
    isRead: r.isRead,
    isSaved: r.isSaved,
    articleType: "feed" as const,
  }));
}

export async function listArticlesForUser(
  database: DB,
  userId: string,
  opts: ListArticlesOptions,
): Promise<ArticlesCursorListResponseDto> {
  const limit = normalizeLimit(opts.limit);
  const { feedSubscriptionsJoin, userStateJoin } = baseJoins(userId);

  const [filtersWithCursor, filtersWithoutCursor] = await Promise.all([
    buildFilters(database, userId, opts, feedSubscriptionsJoin, true),
    buildFilters(database, userId, opts, feedSubscriptionsJoin, false),
  ]);

  const [rows, totalCount] = await Promise.all([
    listArticleRows(database, feedSubscriptionsJoin, userStateJoin, filtersWithCursor, limit + 1),
    countArticlesForUser(database, feedSubscriptionsJoin, userStateJoin, filtersWithoutCursor),
  ]);
  const { hasMore, page, nextCursor } = paginateRows(rows, limit);

  const items = toArticleListItems(page);
  return { items, next_cursor: nextCursor, has_more: hasMore, total_count: totalCount };
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

function pushBaseFilters(filters: SQL[], opts: ListArticlesOptions): void {
  if (opts.feedId) {
    filters.push(eq(feedItems.feedId, opts.feedId));
  }
  if (opts.folderId) {
    filters.push(eq(feedSubscriptions.folderId, opts.folderId));
  }
}

function pushReadSavedFilters(filters: SQL[], opts: ListArticlesOptions): void {
  if (opts.isRead === true) {
    filters.push(sql`(${articleIsReadSql}) = true`);
  } else if (opts.isRead === false) {
    filters.push(sql`(${articleIsReadSql}) = false`);
  }
  if (opts.isSaved === true) {
    filters.push(sql`${feedItemUserState.isSaved} IS TRUE`);
  }
}

function pushPublishedDateFilters(filters: SQL[], opts: ListArticlesOptions): void {
  if (opts.publishedAfter) {
    filters.push(gte(feedItems.publishedAt, opts.publishedAfter));
  }
  if (opts.publishedBefore) {
    filters.push(lt(feedItems.publishedAt, opts.publishedBefore));
  }
}

async function buildFilters(
  database: DB,
  userId: string,
  opts: ListArticlesOptions,
  feedSubscriptionsJoin: SQL<unknown>,
  includeCursorFilter: boolean,
): Promise<SQL[]> {
  const filters: SQL[] = [];
  pushBaseFilters(filters, opts);
  pushReadSavedFilters(filters, opts);
  pushPublishedDateFilters(filters, opts);
  if (includeCursorFilter) {
    await pushCursorFilter(database, userId, opts, feedSubscriptionsJoin, filters);
  }
  return filters;
}

async function pushCursorFilter(
  database: DB,
  userId: string,
  opts: ListArticlesOptions,
  feedSubscriptionsJoin: SQL<unknown>,
  filters: SQL[],
): Promise<void> {
  if (!opts.cursor) {
    return;
  }
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
  if (!c) {
    return;
  }
  filters.push(
    or(
      lt(feedItems.publishedAt, c.publishedAt),
      and(eq(feedItems.publishedAt, c.publishedAt), lt(feedItems.id, c.id)),
    )!,
  );
}

async function listArticleRows(
  database: DB,
  feedSubscriptionsJoin: SQL<unknown>,
  userStateJoin: SQL<unknown>,
  filters: SQL[],
  take: number,
): Promise<RawRow[]> {
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

async function countArticlesForUser(
  database: DB,
  feedSubscriptionsJoin: SQL<unknown>,
  userStateJoin: SQL<unknown>,
  filters: SQL[],
): Promise<number> {
  const [row] = await database
    .select({ c: sql<number>`count(*)::int` })
    .from(feedItems)
    .innerJoin(feedSubscriptions, feedSubscriptionsJoin)
    .leftJoin(feedItemUserState, userStateJoin)
    .where(filters.length > 0 ? and(...filters) : sql`true`);

  return row?.c ?? 0;
}
