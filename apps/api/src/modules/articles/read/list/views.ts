import type { db } from "@adapters/db/client";
import { articleClips, feedItemUserState, feedItems, feeds } from "@kyomi/db";
import { and, asc, desc, eq, gt, gte, ilike, isNotNull, lt, or, sql, type SQL } from "drizzle-orm";
import { AppError } from "@shared/errors/app";
import type { ArticleSort } from "@modules/articles/query";
import type { ArticlesCursorListResponseDto } from "@modules/articles/types";
import { listClipsForUser } from "@modules/articles/write/clips/operations";
import { CLIP_LIST_FEED_ID, CLIP_LIST_FEED_TITLE } from "@modules/articles/write/clips/constants";
import { decodeNullableText, decodeText } from "@shared/text/entities";
import { mergeArticleListsSorted, mergedFeedClipResponsePaged } from "./merge";
import { decodeMergedListCursor } from "./cursor";
import { mergeRecentlyViewedItemsSorted, type RecentlyViewedItem } from "./recent";
import { categoryLabelsSql } from "../labels";
import { listArticlesForUser } from "./query";
import { globalArticleIsReadSql } from "../sql";

type DB = typeof db;

const RECENT_VIEW_CURSOR_PREFIX = "rv1.";

type RecentlyViewedCursor = { lastViewedAt: Date; id: string; isRead?: boolean };
type RecentlyViewedPage = { items: RecentlyViewedItem[]; hasMore: boolean };

function perSourceFetchLimit(responseLimit: number) {
  return Math.min(200, Math.max(responseLimit * 2, responseLimit));
}

function utcDayRange() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function toBase64Url(json: string): string {
  return Buffer.from(json, "utf8").toString("base64url");
}

function fromBase64Url(b64: string): string {
  return Buffer.from(b64, "base64url").toString("utf8");
}

function invalidRecentViewCursor(): never {
  throw new AppError("Invalid recent view cursor.", {
    status: 400,
    code: "RECENT_VIEW_CURSOR_INVALID",
  });
}

function encodeRecentViewCursorFromItem(item: RecentlyViewedItem, sort: ArticleSort): string {
  return `${RECENT_VIEW_CURSOR_PREFIX}${toBase64Url(
    JSON.stringify({
      v: 1,
      va: item.lastViewedAt.toISOString(),
      id: item.id,
      r: item.isRead,
      s: sort,
    }),
  )}`;
}

function decodeRecentViewCursor(cursor: string | undefined): RecentlyViewedCursor | undefined {
  if (cursor === undefined || cursor.trim() === "") {
    return undefined;
  }
  const trimmed = cursor.trim();
  if (!trimmed.startsWith(RECENT_VIEW_CURSOR_PREFIX)) {
    invalidRecentViewCursor();
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fromBase64Url(trimmed.slice(RECENT_VIEW_CURSOR_PREFIX.length)));
  } catch {
    invalidRecentViewCursor();
  }
  if (!raw || typeof raw !== "object") {
    invalidRecentViewCursor();
  }
  const payload = raw as {
    v?: unknown;
    va?: unknown;
    id?: unknown;
    r?: unknown;
  };
  if (payload.v !== 1 || typeof payload.va !== "string" || typeof payload.id !== "string") {
    invalidRecentViewCursor();
  }
  const lastViewedAt = new Date(payload.va);
  if (Number.isNaN(lastViewedAt.getTime()) || !payload.id.trim()) {
    invalidRecentViewCursor();
  }
  return {
    lastViewedAt,
    id: payload.id,
    isRead: typeof payload.r === "boolean" ? payload.r : undefined,
  };
}

function escapeLikePattern(input: string): string {
  return input.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function pushRecentFeedSearchFilter(filters: SQL[], search: string | undefined) {
  const trimmed = search?.trim();
  if (!trimmed) {
    return;
  }
  const pattern = `%${escapeLikePattern(trimmed)}%`;
  filters.push(
    or(
      ilike(feedItems.title, pattern),
      ilike(feedItems.summary, pattern),
      ilike(feeds.title, pattern),
    )!,
  );
}

function pushRecentClipSearchFilter(filters: SQL[], search: string | undefined) {
  const trimmed = search?.trim();
  if (!trimmed) {
    return;
  }
  const pattern = `%${escapeLikePattern(trimmed)}%`;
  filters.push(
    or(
      ilike(articleClips.title, pattern),
      ilike(articleClips.note, pattern),
      ilike(articleClips.url, pattern),
    )!,
  );
}

function pushRecentFeedCursorFilter(
  filters: SQL[],
  sort: ArticleSort,
  cursor: RecentlyViewedCursor | undefined,
) {
  if (!cursor) {
    return;
  }
  const olderThanCursor = or(
    lt(feedItemUserState.lastViewedAt, cursor.lastViewedAt),
    and(eq(feedItemUserState.lastViewedAt, cursor.lastViewedAt), lt(feedItems.id, cursor.id)),
  )!;

  if (sort === "oldest") {
    filters.push(
      or(
        gt(feedItemUserState.lastViewedAt, cursor.lastViewedAt),
        and(eq(feedItemUserState.lastViewedAt, cursor.lastViewedAt), gt(feedItems.id, cursor.id)),
      )!,
    );
    return;
  }

  if (sort === "unread-first" && cursor.isRead !== undefined) {
    filters.push(
      cursor.isRead
        ? and(sql`(${globalArticleIsReadSql}) = true`, olderThanCursor)!
        : or(
            sql`(${globalArticleIsReadSql}) = true`,
            and(sql`(${globalArticleIsReadSql}) = false`, olderThanCursor),
          )!,
    );
    return;
  }

  filters.push(olderThanCursor);
}

function pushRecentClipCursorFilter(
  filters: SQL[],
  sort: ArticleSort,
  cursor: RecentlyViewedCursor | undefined,
) {
  if (!cursor) {
    return;
  }
  const olderThanCursor = or(
    lt(articleClips.lastViewedAt, cursor.lastViewedAt),
    and(eq(articleClips.lastViewedAt, cursor.lastViewedAt), lt(articleClips.id, cursor.id)),
  )!;

  if (sort === "oldest") {
    filters.push(
      or(
        gt(articleClips.lastViewedAt, cursor.lastViewedAt),
        and(eq(articleClips.lastViewedAt, cursor.lastViewedAt), gt(articleClips.id, cursor.id)),
      )!,
    );
    return;
  }

  if (sort === "unread-first" && cursor.isRead !== undefined) {
    filters.push(
      cursor.isRead
        ? and(eq(articleClips.isRead, true), olderThanCursor)!
        : or(eq(articleClips.isRead, true), and(eq(articleClips.isRead, false), olderThanCursor))!,
    );
    return;
  }

  filters.push(olderThanCursor);
}

function recentFeedOrderBy(sort: ArticleSort) {
  if (sort === "oldest") {
    return [asc(feedItemUserState.lastViewedAt), asc(feedItems.id)] as const;
  }
  if (sort === "unread-first") {
    return [
      asc(globalArticleIsReadSql),
      desc(feedItemUserState.lastViewedAt),
      desc(feedItems.id),
    ] as const;
  }
  return [desc(feedItemUserState.lastViewedAt), desc(feedItems.id)] as const;
}

function recentClipOrderBy(sort: ArticleSort) {
  if (sort === "oldest") {
    return [asc(articleClips.lastViewedAt), asc(articleClips.id)] as const;
  }
  if (sort === "unread-first") {
    return [
      asc(articleClips.isRead),
      desc(articleClips.lastViewedAt),
      desc(articleClips.id),
    ] as const;
  }
  return [desc(articleClips.lastViewedAt), desc(articleClips.id)] as const;
}

function recentFeedRowToItem(row: {
  id: string;
  title: string;
  link: string;
  summary: string | null;
  publishedAt: Date;
  feedId: string;
  feedUrl: string | null;
  feedSiteUrl: string | null;
  feedTitle: string;
  feedFaviconUrl: string | null;
  isRead: boolean;
  isSaved: boolean;
  categories: string[];
  lastViewedAt: Date | null;
}): RecentlyViewedItem {
  return {
    id: row.id,
    title: decodeText(row.title),
    link: row.link,
    summary: decodeNullableText(row.summary),
    publishedAt: row.publishedAt.toISOString(),
    feedId: row.feedId,
    feedUrl: row.feedUrl,
    feedSiteUrl: row.feedSiteUrl,
    feedTitle: decodeText(row.feedTitle),
    feedFaviconUrl: row.feedFaviconUrl,
    isRead: row.isRead,
    isSaved: row.isSaved,
    articleType: "feed",
    categories: row.categories.map((label) => decodeText(label)),
    lastViewedAt: row.lastViewedAt ?? row.publishedAt,
  };
}

function recentClipRowToItem(row: typeof articleClips.$inferSelect): RecentlyViewedItem {
  return {
    id: row.id,
    title: row.title,
    link: row.url,
    summary: row.note,
    publishedAt: row.createdAt.toISOString(),
    feedId: CLIP_LIST_FEED_ID,
    feedUrl: row.url,
    feedSiteUrl: null,
    feedTitle: CLIP_LIST_FEED_TITLE,
    feedFaviconUrl: null,
    isRead: row.isRead,
    isSaved: row.isSaved,
    articleType: "clip",
    categories: [],
    lastViewedAt: row.lastViewedAt ?? row.createdAt,
  };
}

async function listRecentlyViewedFeedItems(
  database: DB,
  userId: string,
  limit: number,
  cursor: RecentlyViewedCursor | undefined,
  sort: ArticleSort,
  search?: string,
): Promise<RecentlyViewedPage> {
  const filters: SQL[] = [
    eq(feedItemUserState.userId, userId),
    isNotNull(feedItemUserState.lastViewedAt),
    sql`${feedItemUserState.hiddenAt} IS NULL`,
  ];
  pushRecentFeedSearchFilter(filters, search);
  pushRecentFeedCursorFilter(filters, sort, cursor);

  const rows = await database
    .select({
      id: feedItems.id,
      title: feedItems.title,
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
      categories: categoryLabelsSql,
      lastViewedAt: feedItemUserState.lastViewedAt,
    })
    .from(feedItemUserState)
    .innerJoin(feedItems, eq(feedItemUserState.feedItemId, feedItems.id))
    .innerJoin(feeds, eq(feedItems.feedId, feeds.id))
    .where(and(...filters))
    .orderBy(...recentFeedOrderBy(sort))
    .limit(limit + 1);

  return {
    items: rows.slice(0, limit).map(recentFeedRowToItem),
    hasMore: rows.length > limit,
  };
}

async function listRecentlyViewedClipItems(
  database: DB,
  userId: string,
  limit: number,
  cursor: RecentlyViewedCursor | undefined,
  sort: ArticleSort,
  search?: string,
): Promise<RecentlyViewedPage> {
  const filters: SQL[] = [eq(articleClips.userId, userId), isNotNull(articleClips.lastViewedAt)];
  pushRecentClipSearchFilter(filters, search);
  pushRecentClipCursorFilter(filters, sort, cursor);

  const rows = await database
    .select()
    .from(articleClips)
    .where(and(...filters))
    .orderBy(...recentClipOrderBy(sort))
    .limit(limit + 1);

  return {
    items: rows.slice(0, limit).map(recentClipRowToItem),
    hasMore: rows.length > limit,
  };
}

function mergedRecentlyViewedResponsePaged(
  mergedSorted: RecentlyViewedItem[],
  limit: number,
  feedHasMore: boolean,
  clipHasMore: boolean,
  sort: ArticleSort,
): ArticlesCursorListResponseDto {
  const cap = Math.min(Math.max(limit, 1), 200);
  const page = mergedSorted.slice(0, cap);
  const hasMore = mergedSorted.length > cap || feedHasMore || clipHasMore;
  const nextCursor =
    hasMore && page.length > 0
      ? encodeRecentViewCursorFromItem(page[page.length - 1]!, sort)
      : null;

  return {
    items: page.map(({ lastViewedAt: _lastViewedAt, ...item }) => item),
    next_cursor: nextCursor,
    has_more: hasMore,
    total_count: null,
  };
}

export async function listMergedTodayView(
  database: DB,
  userId: string,
  limit: number,
  cursor?: string,
  sort: ArticleSort = "latest",
) {
  const boundary = decodeMergedListCursor(cursor);
  const take = perSourceFetchLimit(limit);
  const { start, end } = utcDayRange();
  const [feed, clips] = await Promise.all([
    listArticlesForUser(database, userId, {
      limit: take,
      publishedAfter: start,
      publishedBefore: end,
      exclusiveBefore: boundary,
      sort,
    }),
    listClipsForUser(database, userId, {
      limit: take,
      publishedAfter: start,
      publishedBefore: end,
      exclusiveBefore: boundary,
      sort,
    }),
  ]);
  const mergedSorted = mergeArticleListsSorted([feed.items, clips.items], sort);
  return mergedFeedClipResponsePaged(mergedSorted, limit, feed.has_more, clips.has_more, sort);
}

export async function listMergedRecentlyReadView(
  database: DB,
  userId: string,
  limit: number,
  cursor?: string,
  sort: ArticleSort = "latest",
  search?: string,
) {
  const boundary = decodeRecentViewCursor(cursor);
  const take = perSourceFetchLimit(limit);
  const [feed, clips] = await Promise.all([
    listRecentlyViewedFeedItems(database, userId, take, boundary, sort, search),
    listRecentlyViewedClipItems(database, userId, take, boundary, sort, search),
  ]);
  const mergedSorted = mergeRecentlyViewedItemsSorted([...feed.items, ...clips.items], sort);
  return mergedRecentlyViewedResponsePaged(mergedSorted, limit, feed.hasMore, clips.hasMore, sort);
}

export async function listMergedSavedView(
  database: DB,
  userId: string,
  limit: number,
  cursor?: string,
  sort: ArticleSort = "latest",
) {
  const boundary = decodeMergedListCursor(cursor);
  const take = perSourceFetchLimit(limit);
  const [feed, clips] = await Promise.all([
    listArticlesForUser(database, userId, {
      limit: take,
      isSaved: true,
      exclusiveBefore: boundary,
      sort,
    }),
    listClipsForUser(database, userId, {
      limit: take,
      isSaved: true,
      exclusiveBefore: boundary,
      sort,
    }),
  ]);
  const mergedSorted = mergeArticleListsSorted([feed.items, clips.items], sort);
  return mergedFeedClipResponsePaged(mergedSorted, limit, feed.has_more, clips.has_more, sort);
}
