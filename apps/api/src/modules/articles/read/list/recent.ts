import { Effect } from "effect";
import { articleClips, feedItemUserState, feedItems, feeds } from "@kyomi/db";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { Db } from "@adapters/db/service";
import { AppConfig } from "@config/env/service";
import type { ArticleSort } from "@modules/articles/params";
import type { ArticleListItemDto, ArticlesCursorListResponseDto } from "@modules/articles/types";
import { clipReadColumns, type ClipReadRow } from "@modules/articles/write/clips/columns";
import { CLIP_LIST_FEED_ID, CLIP_LIST_FEED_TITLE } from "@modules/articles/write/clips/constants";
import { decodeNullableText, decodeText } from "@shared/text/entities";
import { encodeRecentViewCursor, type RecentBoundary } from "./cursor";
import { keysetFilter, keysetOrderBy, type KeysetColumns } from "./keyset";
import { sliceMergedPage } from "./merge";
import { categoryLabelsFor } from "../labels";
import { globalArticleIsReadSql, searchFilter } from "../sql";

export type RecentlyViewedItem = Omit<ArticleListItemDto, "lastViewedAt"> & {
  lastViewedAt: Date;
};

type RecentlyViewedPage = { items: RecentlyViewedItem[]; hasMore: boolean };

export function compareRecentlyViewedItems(
  left: RecentlyViewedItem,
  right: RecentlyViewedItem,
  sort: ArticleSort,
) {
  if (sort === "unread-first" && left.isRead !== right.isRead) {
    return Number(left.isRead) - Number(right.isRead);
  }
  const timeDiff =
    sort === "oldest"
      ? left.lastViewedAt.getTime() - right.lastViewedAt.getTime()
      : right.lastViewedAt.getTime() - left.lastViewedAt.getTime();
  if (timeDiff !== 0) {
    return timeDiff;
  }
  return sort === "oldest" ? left.id.localeCompare(right.id) : right.id.localeCompare(left.id);
}

export function mergeRecentlyViewedItemsSorted(items: RecentlyViewedItem[], sort: ArticleSort) {
  return [...items].sort((left, right) => compareRecentlyViewedItems(left, right, sort));
}

const feedKeyset: KeysetColumns = {
  at: feedItemUserState.lastViewedAt,
  id: feedItems.id,
  isRead: globalArticleIsReadSql,
};

const clipKeyset: KeysetColumns = {
  at: articleClips.lastViewedAt,
  id: articleClips.id,
  isRead: articleClips.isRead,
};

const toKeysetBoundary = (boundary: RecentBoundary | undefined) =>
  boundary && { at: boundary.lastViewedAt, id: boundary.id, isRead: boundary.isRead };

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
    readingProgress: null,
  };
}

function recentClipRowToItem(row: ClipReadRow): RecentlyViewedItem {
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
    readingProgress: null,
  };
}

type RecentQuery = {
  userId: string;
  limit: number;
  boundary: RecentBoundary | undefined;
  sort: ArticleSort;
  search?: string;
};

/** Feed items the user has opened, most recently viewed first (per `sort`). */
export const listRecentlyViewedFeedItems = Effect.fn("articles.recent.feed")(function* ({
  userId,
  limit,
  boundary,
  sort,
  search,
}: RecentQuery) {
  const db = yield* Db;
  const config = yield* AppConfig;
  const keyset = toKeysetBoundary(boundary);
  const where = and(
    eq(feedItemUserState.userId, userId),
    isNotNull(feedItemUserState.lastViewedAt),
    sql`${feedItemUserState.hiddenAt} IS NULL`,
    searchFilter(search, [feedItems.title, feedItems.summary, feeds.title]),
    keyset ? keysetFilter(feedKeyset, sort, keyset) : undefined,
  );

  const rows = yield* db.use("articles.recent.feed", (client) =>
    client
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
        categories: categoryLabelsFor(config),
        lastViewedAt: feedItemUserState.lastViewedAt,
      })
      .from(feedItemUserState)
      .innerJoin(feedItems, eq(feedItemUserState.feedItemId, feedItems.id))
      .innerJoin(feeds, eq(feedItems.feedId, feeds.id))
      .where(where)
      .orderBy(...keysetOrderBy(feedKeyset, sort))
      .limit(limit + 1),
  );

  return {
    items: rows.slice(0, limit).map(recentFeedRowToItem),
    hasMore: rows.length > limit,
  } satisfies RecentlyViewedPage;
});

/** Clips the user has opened, most recently viewed first (per `sort`). */
export const listRecentlyViewedClipItems = Effect.fn("articles.recent.clips")(function* ({
  userId,
  limit,
  boundary,
  sort,
  search,
}: RecentQuery) {
  const db = yield* Db;
  const keyset = toKeysetBoundary(boundary);
  const where = and(
    eq(articleClips.userId, userId),
    isNotNull(articleClips.lastViewedAt),
    searchFilter(search, [articleClips.title, articleClips.note, articleClips.url]),
    keyset ? keysetFilter(clipKeyset, sort, keyset) : undefined,
  );

  const rows = yield* db.use("articles.recent.clips", (client) =>
    client
      .select(clipReadColumns)
      .from(articleClips)
      .where(where)
      .orderBy(...keysetOrderBy(clipKeyset, sort))
      .limit(limit + 1),
  );

  return {
    items: rows.slice(0, limit).map(recentClipRowToItem),
    hasMore: rows.length > limit,
  } satisfies RecentlyViewedPage;
});

export function mergedRecentlyViewedResponsePaged(
  mergedSorted: RecentlyViewedItem[],
  limit: number,
  feedHasMore: boolean,
  clipHasMore: boolean,
  sort: ArticleSort,
): ArticlesCursorListResponseDto {
  const { page, hasMore } = sliceMergedPage(mergedSorted, limit, [feedHasMore, clipHasMore]);
  const nextCursor =
    hasMore && page.length > 0 ? encodeRecentViewCursor(page[page.length - 1]!, sort) : null;

  return {
    items: page.map(({ lastViewedAt, ...item }) => ({
      ...item,
      lastViewedAt: lastViewedAt.toISOString(),
    })),
    next_cursor: nextCursor,
    has_more: hasMore,
    total_count: null,
  };
}
