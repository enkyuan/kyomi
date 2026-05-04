import type { db } from "@adapters/db/client";
import { feedItemUserState, feedItems, feedSubscriptions, feeds } from "@cronos/db";
import { and, desc, eq, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { logger } from "@adapters/logger";
import { decodeNullableText, decodeText } from "@shared/text/html-entities";
import { collapseObviousDuplicates, type ArticleListRawRow } from "./dedupe";
import { articleIsReadSql } from "./sql";
import type { ArticleListItemDto, ArticlesCursorListResponseDto } from "../types";

type DB = typeof db;

export type ListArticlesOptions = {
  feedId?: string;
  folderId?: string;
  search?: string;
  isRead?: boolean;
  isSaved?: boolean;
  publishedAfter?: Date;
  publishedBefore?: Date;
  limit: number;
  cursor?: string;
  /** Merged feed+clip pagination: rows strictly older than this (publishedAt, id) in global sort order. */
  exclusiveBefore?: { publishedAt: Date; id: string };
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

function encodeCompositeCursor(row: Pick<ArticleListRawRow, "publishedAt" | "id">): string {
  return `${row.publishedAt.toISOString()}::${row.id}`;
}

function decodeCompositeCursor(cursor: string): { publishedAt: Date; id: string } | null {
  const parts = cursor.split("::");
  if (parts.length !== 2) {
    return null;
  }
  const [publishedAtIso, id] = parts;
  if (!publishedAtIso || !id) {
    return null;
  }
  const publishedAt = new Date(publishedAtIso);
  if (Number.isNaN(publishedAt.getTime())) {
    return null;
  }
  return { publishedAt, id };
}

function computeFetchWindowSize(opts: ListArticlesOptions, take: number): number {
  const multiplier = opts.feedId ? 2 : 3;
  return Math.min(800, take * multiplier);
}

function paginateRows(rows: ArticleListRawRow[], limit: number) {
  const dedupedRows = collapseObviousDuplicates(rows);
  if (dedupedRows.length !== rows.length) {
    logger.warn("articles.list_time_dedupe.collapsed", {
      rawCount: rows.length,
      dedupedCount: dedupedRows.length,
      collapsedCount: rows.length - dedupedRows.length,
    });
  }
  const hasMore = dedupedRows.length > limit;
  const page = hasMore ? dedupedRows.slice(0, limit) : dedupedRows;
  const nextCursor =
    hasMore && page.length > 0 ? encodeCompositeCursor(page[page.length - 1]!) : null;
  return { hasMore, page, nextCursor };
}

function toArticleListItems(page: ArticleListRawRow[]): ArticleListItemDto[] {
  return page.map((r) => ({
    id: r.id,
    title: decodeText(r.title),
    link: r.link,
    summary: decodeNullableText(r.summary),
    publishedAt: r.publishedAt.toISOString(),
    feedId: r.feedId,
    feedTitle: decodeText(r.feedTitle),
    feedFaviconUrl: r.feedFaviconUrl,
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

  const rows = await listArticleRows(database, userId, opts, limit + 1);
  const { hasMore, page, nextCursor } = paginateRows(rows, limit);

  const items = toArticleListItems(page);
  return { items, next_cursor: nextCursor, has_more: hasMore, total_count: null };
}

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

function escapeLikePattern(input: string): string {
  return input.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function pushSearchFilter(filters: SQL[], opts: ListArticlesOptions): void {
  const search = opts.search?.trim();
  if (!search) {
    return;
  }
  const pattern = `%${escapeLikePattern(search)}%`;
  filters.push(
    or(
      ilike(feedItems.title, pattern),
      ilike(feedItems.summary, pattern),
      ilike(feeds.title, pattern),
    )!,
  );
}

async function pushCursorFilter(
  database: DB,
  userId: string,
  opts: ListArticlesOptions,
  feedSubscriptionsJoin: SQL<unknown> | undefined,
  filters: SQL[],
): Promise<void> {
  if (!opts.cursor || !feedSubscriptionsJoin) {
    return;
  }
  const decoded = decodeCompositeCursor(opts.cursor);
  if (decoded) {
    filters.push(
      or(
        lt(feedItems.publishedAt, decoded.publishedAt),
        and(eq(feedItems.publishedAt, decoded.publishedAt), lt(feedItems.id, decoded.id)),
      )!,
    );
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
  userId: string,
  opts: ListArticlesOptions,
  take: number,
): Promise<ArticleListRawRow[]> {
  const { feedSubscriptionsJoin, userStateJoin } = baseJoins(userId);

  const filters: SQL[] = [];
  pushBaseFilters(filters, opts);
  pushReadSavedFilters(filters, opts);
  pushPublishedDateFilters(filters, opts);
  pushSearchFilter(filters, opts);
  if (opts.exclusiveBefore) {
    const { publishedAt, id } = opts.exclusiveBefore;
    filters.push(
      or(
        lt(feedItems.publishedAt, publishedAt),
        and(eq(feedItems.publishedAt, publishedAt), lt(feedItems.id, id)),
      )!,
    );
  } else {
    await pushCursorFilter(database, userId, opts, feedSubscriptionsJoin, filters);
  }

  return database
    .select({
      id: feedItems.id,
      title: feedItems.title,
      canonicalUrl: feedItems.canonicalUrl,
      link: feedItems.link,
      summary: feedItems.summary,
      publishedAt: feedItems.publishedAt,
      feedId: feedItems.feedId,
      feedTitle: feeds.title,
      feedFaviconUrl: feeds.faviconUrl,
      isRead: articleIsReadSql,
      isSaved: sql<boolean>`COALESCE(${feedItemUserState.isSaved}, false)`,
    })
    .from(feedItems)
    .innerJoin(feedSubscriptions, feedSubscriptionsJoin)
    .innerJoin(feeds, eq(feedItems.feedId, feeds.id))
    .leftJoin(feedItemUserState, userStateJoin)
    .where(filters.length > 0 ? and(...filters) : sql`true`)
    .orderBy(desc(feedItems.publishedAt), desc(feedItems.id))
    .limit(computeFetchWindowSize(opts, take));
}
