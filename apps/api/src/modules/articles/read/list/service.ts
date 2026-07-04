import type { db } from "@adapters/db/client";
import { feedItemUserState, feedItems, feedSubscriptions, feeds } from "@kyomi/db";
import { and, asc, desc, eq, gt, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { logger } from "@adapters/logger";
import type { ArticleSort } from "@modules/articles/query";
import type { ArticleListItemDto, ArticlesCursorListResponseDto } from "@modules/articles/types";
import { decodeNullableText, decodeText } from "@shared/text/entities";
import { collapseObviousDuplicates, type ArticleListRawRow } from "./dedupe";
import { feedCategoryLabelsSql } from "../category-labels";
import { articleIsReadSql, globalArticleIsReadSql } from "../sql";
import { capPublishedBeforeAtNow } from "./window";

type DB = typeof db;

export type ListArticlesOptions = {
  feedId?: string;
  folderId?: string;
  search?: string;
  isRead?: boolean;
  isSaved?: boolean;
  publishedAfter?: Date;
  publishedBefore?: Date;
  sort?: ArticleSort;
  limit: number;
  cursor?: string;
  /** Merged feed+clip pagination boundary in the active sort order. */
  exclusiveBefore?: { publishedAt: Date; id: string; isRead?: boolean };
};

type GlobalListArticlesOptions = Omit<ListArticlesOptions, "feedId" | "folderId">;

type ArticleCursor = { publishedAt: Date; id: string; isRead?: boolean };

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

function toBase64Url(json: string): string {
  return Buffer.from(json, "utf8").toString("base64url");
}

function fromBase64Url(b64: string): string {
  return Buffer.from(b64, "base64url").toString("utf8");
}

function encodeCompositeCursor(
  row: Pick<ArticleListRawRow, "publishedAt" | "id" | "isRead">,
  sort: ArticleSort,
): string {
  return `a1.${toBase64Url(
    JSON.stringify({
      v: 1,
      s: sort,
      pa: row.publishedAt.toISOString(),
      id: row.id,
      r: row.isRead,
    }),
  )}`;
}

function decodeCompositeCursor(cursor: string): ArticleCursor | null {
  const trimmed = cursor.trim();
  if (trimmed.startsWith("a1.")) {
    try {
      const raw = JSON.parse(fromBase64Url(trimmed.slice(3))) as {
        pa?: unknown;
        id?: unknown;
        r?: unknown;
      };
      if (typeof raw.pa !== "string" || typeof raw.id !== "string" || !raw.id.trim()) {
        return null;
      }
      const publishedAt = new Date(raw.pa);
      if (Number.isNaN(publishedAt.getTime())) {
        return null;
      }
      return {
        publishedAt,
        id: raw.id,
        isRead: typeof raw.r === "boolean" ? raw.r : undefined,
      };
    } catch {
      return null;
    }
  }

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

function computeFetchWindowSize(opts: { feedId?: string }, take: number): number {
  const multiplier = opts.feedId ? 2 : 3;
  return Math.min(800, take * multiplier);
}

function compareArticleRowsForSort(
  left: ArticleListRawRow,
  right: ArticleListRawRow,
  sort: ArticleSort,
): number {
  if (sort === "oldest") {
    const publishedDiff = left.publishedAt.getTime() - right.publishedAt.getTime();
    if (publishedDiff !== 0) {
      return publishedDiff;
    }
    return left.id.localeCompare(right.id);
  }
  if (sort === "unread-first" && left.isRead !== right.isRead) {
    return Number(left.isRead) - Number(right.isRead);
  }
  const publishedDiff = right.publishedAt.getTime() - left.publishedAt.getTime();
  if (publishedDiff !== 0) {
    return publishedDiff;
  }
  return right.id.localeCompare(left.id);
}

function paginateRows(rows: ArticleListRawRow[], limit: number, sort: ArticleSort) {
  const visibleRows = filterVisibleArticleRows(rows);
  const dedupedRows = collapseObviousDuplicates(visibleRows).sort((left, right) =>
    compareArticleRowsForSort(left, right, sort),
  );
  if (dedupedRows.length !== visibleRows.length) {
    logger.warn("articles.list_time_dedupe.collapsed", {
      rawCount: visibleRows.length,
      dedupedCount: dedupedRows.length,
      collapsedCount: visibleRows.length - dedupedRows.length,
    });
  }
  const hasMore = dedupedRows.length > limit;
  const page = hasMore ? dedupedRows.slice(0, limit) : dedupedRows;
  const nextCursor =
    hasMore && page.length > 0 ? encodeCompositeCursor(page[page.length - 1]!, sort) : null;
  return { hasMore, page, nextCursor };
}

function filterVisibleArticleRows(rows: ArticleListRawRow[]): ArticleListRawRow[] {
  return rows.filter((row) => row.hiddenAt == null);
}

export const filterVisibleArticleRowsForTest = filterVisibleArticleRows;

function toArticleListItems(page: ArticleListRawRow[]): ArticleListItemDto[] {
  return page.map((r) => ({
    id: r.id,
    title: decodeText(r.title),
    link: r.link,
    summary: decodeNullableText(r.summary),
    publishedAt: r.publishedAt.toISOString(),
    feedId: r.feedId,
    feedUrl: r.feedUrl,
    feedSiteUrl: r.feedSiteUrl,
    feedTitle: decodeText(r.feedTitle),
    feedFaviconUrl: r.feedFaviconUrl,
    isRead: r.isRead,
    isSaved: r.isSaved,
    articleType: "feed" as const,
    categories: r.categories.map((label) => decodeText(label)),
  }));
}

export const toArticleListItemsForTest = toArticleListItems;

export async function listArticlesForUser(
  database: DB,
  userId: string,
  opts: ListArticlesOptions,
): Promise<ArticlesCursorListResponseDto> {
  const limit = normalizeLimit(opts.limit);
  const sort = opts.sort ?? "newest";

  const rows = await listArticleRows(database, userId, opts, limit + 1);
  const { hasMore, page, nextCursor } = paginateRows(rows, limit, sort);

  const items = toArticleListItems(page);
  return { items, next_cursor: nextCursor, has_more: hasMore, total_count: null };
}

export async function listAllArticlesForUser(
  database: DB,
  userId: string,
  opts: GlobalListArticlesOptions,
): Promise<ArticlesCursorListResponseDto> {
  const limit = normalizeLimit(opts.limit);
  const sort = opts.sort ?? "newest";

  const rows = await listGlobalArticleRows(database, userId, opts, limit + 1);
  const { hasMore, page, nextCursor } = paginateRows(rows, limit, sort);

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

function pushGlobalReadSavedFilters(filters: SQL[], opts: GlobalListArticlesOptions): void {
  if (opts.isRead === true) {
    filters.push(sql`(${globalArticleIsReadSql}) = true`);
  } else if (opts.isRead === false) {
    filters.push(sql`(${globalArticleIsReadSql}) = false`);
  }
  if (opts.isSaved === true) {
    filters.push(sql`${feedItemUserState.isSaved} IS TRUE`);
  }
}

function pushHiddenFilter(filters: SQL[]): void {
  filters.push(sql`${feedItemUserState.hiddenAt} IS NULL`);
}

function pushPublishedDateFilters(filters: SQL[], opts: ListArticlesOptions): void {
  if (opts.publishedAfter) {
    filters.push(gte(feedItems.publishedAt, opts.publishedAfter));
  }
  filters.push(lt(feedItems.publishedAt, capPublishedBeforeAtNow(opts.publishedBefore)));
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
  userStateJoin: SQL<unknown> | undefined,
  filters: SQL[],
): Promise<void> {
  if (!opts.cursor || !feedSubscriptionsJoin) {
    return;
  }
  const decoded = decodeCompositeCursor(opts.cursor);
  if (decoded) {
    pushSortBoundaryFilter(filters, opts.sort ?? "newest", decoded);
    return;
  }
  const cur = await database
    .select({
      publishedAt: feedItems.publishedAt,
      id: feedItems.id,
      isRead: articleIsReadSql,
    })
    .from(feedItems)
    .innerJoin(feedSubscriptions, feedSubscriptionsJoin)
    .leftJoin(feedItemUserState, userStateJoin)
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
  pushSortBoundaryFilter(filters, opts.sort ?? "newest", c);
}

async function pushGlobalCursorFilter(
  database: DB,
  opts: GlobalListArticlesOptions,
  userStateJoin: SQL<unknown> | undefined,
  filters: SQL[],
): Promise<void> {
  if (!opts.cursor) {
    return;
  }
  const decoded = decodeCompositeCursor(opts.cursor);
  if (decoded) {
    pushSortBoundaryFilter(filters, opts.sort ?? "newest", decoded, globalArticleIsReadSql);
    return;
  }
  const cur = await database
    .select({
      publishedAt: feedItems.publishedAt,
      id: feedItems.id,
      isRead: globalArticleIsReadSql,
    })
    .from(feedItems)
    .leftJoin(feedItemUserState, userStateJoin)
    .where(eq(feedItems.id, opts.cursor))
    .limit(1);
  const c = cur[0];
  if (!c) {
    return;
  }
  pushSortBoundaryFilter(filters, opts.sort ?? "newest", c, globalArticleIsReadSql);
}

function pushSortBoundaryFilter(
  filters: SQL[],
  sort: ArticleSort,
  cursor: ArticleCursor,
  readSql: SQL<boolean> = articleIsReadSql,
): void {
  const olderThanCursor = or(
    lt(feedItems.publishedAt, cursor.publishedAt),
    and(eq(feedItems.publishedAt, cursor.publishedAt), lt(feedItems.id, cursor.id)),
  )!;
  if (sort === "oldest") {
    filters.push(
      or(
        gt(feedItems.publishedAt, cursor.publishedAt),
        and(eq(feedItems.publishedAt, cursor.publishedAt), gt(feedItems.id, cursor.id)),
      )!,
    );
    return;
  }
  if (sort === "unread-first" && cursor.isRead !== undefined) {
    filters.push(
      cursor.isRead
        ? and(sql`(${readSql}) = true`, olderThanCursor)!
        : or(sql`(${readSql}) = true`, and(sql`(${readSql}) = false`, olderThanCursor))!,
    );
    return;
  }
  filters.push(olderThanCursor);
}

function orderByForSort(sort: ArticleSort, readSql: SQL<boolean> = articleIsReadSql) {
  if (sort === "oldest") {
    return [asc(feedItems.publishedAt), asc(feedItems.id)] as const;
  }
  if (sort === "unread-first") {
    return [asc(readSql), desc(feedItems.publishedAt), desc(feedItems.id)] as const;
  }
  return [desc(feedItems.publishedAt), desc(feedItems.id)] as const;
}

async function listArticleRows(
  database: DB,
  userId: string,
  opts: ListArticlesOptions,
  take: number,
): Promise<ArticleListRawRow[]> {
  const { feedSubscriptionsJoin, userStateJoin } = baseJoins(userId);
  const sort = opts.sort ?? "newest";

  const filters: SQL[] = [];
  pushBaseFilters(filters, opts);
  pushReadSavedFilters(filters, opts);
  pushHiddenFilter(filters);
  pushPublishedDateFilters(filters, opts);
  pushSearchFilter(filters, opts);
  if (opts.exclusiveBefore) {
    pushSortBoundaryFilter(filters, sort, opts.exclusiveBefore);
  } else {
    await pushCursorFilter(database, userId, opts, feedSubscriptionsJoin, userStateJoin, filters);
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
      feedUrl: feeds.url,
      feedSiteUrl: feeds.link,
      feedTitle: feeds.title,
      feedFaviconUrl: feeds.faviconUrl,
      isRead: articleIsReadSql,
      isSaved: sql<boolean>`COALESCE(${feedItemUserState.isSaved}, false)`,
      hiddenAt: feedItemUserState.hiddenAt,
      categories: feedCategoryLabelsSql,
    })
    .from(feedItems)
    .innerJoin(feedSubscriptions, feedSubscriptionsJoin)
    .innerJoin(feeds, eq(feedItems.feedId, feeds.id))
    .leftJoin(feedItemUserState, userStateJoin)
    .where(filters.length > 0 ? and(...filters) : sql`true`)
    .orderBy(...orderByForSort(sort))
    .limit(computeFetchWindowSize(opts, take));
}

async function listGlobalArticleRows(
  database: DB,
  userId: string,
  opts: GlobalListArticlesOptions,
  take: number,
): Promise<ArticleListRawRow[]> {
  const userStateJoin = and(
    eq(feedItemUserState.feedItemId, feedItems.id),
    eq(feedItemUserState.userId, userId),
  );
  const sort = opts.sort ?? "newest";

  const filters: SQL[] = [];
  pushGlobalReadSavedFilters(filters, opts);
  pushHiddenFilter(filters);
  pushPublishedDateFilters(filters, opts);
  pushSearchFilter(filters, opts);
  if (opts.exclusiveBefore) {
    pushSortBoundaryFilter(filters, sort, opts.exclusiveBefore, globalArticleIsReadSql);
  } else {
    await pushGlobalCursorFilter(database, opts, userStateJoin, filters);
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
      feedUrl: feeds.url,
      feedSiteUrl: feeds.link,
      feedTitle: feeds.title,
      feedFaviconUrl: feeds.faviconUrl,
      isRead: globalArticleIsReadSql,
      isSaved: sql<boolean>`COALESCE(${feedItemUserState.isSaved}, false)`,
      hiddenAt: feedItemUserState.hiddenAt,
      categories: feedCategoryLabelsSql,
    })
    .from(feedItems)
    .innerJoin(feeds, eq(feedItems.feedId, feeds.id))
    .leftJoin(feedItemUserState, userStateJoin)
    .where(filters.length > 0 ? and(...filters) : sql`true`)
    .orderBy(...orderByForSort(sort, globalArticleIsReadSql))
    .limit(computeFetchWindowSize({}, take));
}
