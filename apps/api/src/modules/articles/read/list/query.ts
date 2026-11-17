import { Effect } from "effect";
import { feedItemUserState, feedItems, feedSubscriptions, feeds } from "@kyomi/db";
import { and, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { currentDate } from "@modules/articles/clock";
import { Db } from "@adapters/db/service";
import { AppLogger } from "@adapters/logger/service";
import { AppConfig } from "@config/env/service";
import { attachReadingProgress } from "@modules/articles/progress/read";
import type { ArticleSort } from "@modules/articles/params";
import type { ArticleListItemDto, ArticlesCursorListResponseDto } from "@modules/articles/types";
import { decodeNullableText, decodeText } from "@shared/text/entities";
import {
  collapseObviousDuplicates,
  filterVisibleArticleRows,
  type ArticleListRawRow,
} from "./dedupe";
import { decodeCompositeCursor, encodeCompositeCursor } from "./cursor";
import { keysetFilter, keysetOrderBy, type KeysetBoundary, type KeysetColumns } from "./keyset";
import { capPublishedBeforeAtNow, clampLimit } from "./window";
import { categoryLabelsFor } from "../labels";
import {
  readSqlFor,
  searchFilter,
  subscriptionJoin,
  userStateJoin,
  visibleFeedItemSql,
  type FeedScope,
} from "../sql";

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

const keysetColumnsFor = (scope: FeedScope): KeysetColumns => ({
  at: feedItems.publishedAt,
  id: feedItems.id,
  isRead: readSqlFor(scope),
});

const toBoundary = (boundary: {
  publishedAt: Date;
  id: string;
  isRead?: boolean;
}): KeysetBoundary => ({ at: boundary.publishedAt, id: boundary.id, isRead: boundary.isRead });

function computeFetchWindowSize(feedScoped: boolean, take: number): number {
  return Math.min(800, take * (feedScoped ? 2 : 3));
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
  const hasMore = dedupedRows.length > limit;
  const page = hasMore ? dedupedRows.slice(0, limit) : dedupedRows;
  const nextCursor =
    hasMore && page.length > 0 ? encodeCompositeCursor(page[page.length - 1]!, sort) : null;
  return {
    hasMore,
    page,
    nextCursor,
    rawCount: visibleRows.length,
    dedupedCount: dedupedRows.length,
  };
}

export function toArticleListItems(page: ArticleListRawRow[]): ArticleListItemDto[] {
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
    lastViewedAt: r.lastViewedAt?.toISOString() ?? null,
    articleType: "feed" as const,
    categories: r.categories.map((label) => decodeText(label)),
    readingProgress: null,
  }));
}

/**
 * Where the page starts. Preference order: the merged-view boundary, an `a1.`/`<iso>::<id>`
 * cursor, then (oldest format) the id of the last article of the previous page, which is looked
 * up. An id that no longer resolves starts from the first page.
 */
const resolveBoundary = Effect.fn("articles.list.boundary")(function* (
  userId: string,
  opts: ListArticlesOptions,
  scope: FeedScope,
) {
  if (opts.exclusiveBefore) {
    return toBoundary(opts.exclusiveBefore);
  }
  if (!opts.cursor) {
    return undefined;
  }
  const decoded = decodeCompositeCursor(opts.cursor);
  if (decoded) {
    return toBoundary(decoded);
  }
  const cursorId = opts.cursor;
  const db = yield* Db;
  const columns = {
    publishedAt: feedItems.publishedAt,
    id: feedItems.id,
    isRead: readSqlFor(scope),
  };
  const [row] = yield* db.use("articles.list.cursor", (client) =>
    scope === "subscribed"
      ? client
          .select(columns)
          .from(feedItems)
          .innerJoin(feedSubscriptions, subscriptionJoin(userId))
          .leftJoin(feedItemUserState, userStateJoin(userId))
          .where(
            and(
              eq(feedItems.id, cursorId),
              opts.folderId ? eq(feedSubscriptions.folderId, opts.folderId) : undefined,
            ),
          )
          .limit(1)
      : client
          .select(columns)
          .from(feedItems)
          .leftJoin(feedItemUserState, userStateJoin(userId))
          .where(eq(feedItems.id, cursorId))
          .limit(1),
  );
  return row ? toBoundary(row) : undefined;
});

function listFilters(
  scope: FeedScope,
  opts: ListArticlesOptions,
  now: Date,
  boundary: KeysetBoundary | undefined,
) {
  const readSql = readSqlFor(scope);
  const subscribed = scope === "subscribed";
  const sort = opts.sort ?? "latest";
  return and(
    subscribed && opts.feedId ? eq(feedItems.feedId, opts.feedId) : undefined,
    subscribed && opts.folderId ? eq(feedSubscriptions.folderId, opts.folderId) : undefined,
    opts.isRead === true ? sql`(${readSql}) = true` : undefined,
    opts.isRead === false ? sql`(${readSql}) = false` : undefined,
    opts.isSaved === true ? sql`${feedItemUserState.isSaved} IS TRUE` : undefined,
    visibleFeedItemSql,
    opts.publishedAfter ? gte(feedItems.publishedAt, opts.publishedAfter) : undefined,
    lt(feedItems.publishedAt, capPublishedBeforeAtNow(opts.publishedBefore, now)),
    searchFilter(opts.search, [feedItems.title, feedItems.summary, feeds.title]),
    boundary ? keysetFilter(keysetColumnsFor(scope), sort, boundary) : undefined,
  );
}

const listRows = Effect.fn("articles.list.rows")(function* (
  userId: string,
  opts: ListArticlesOptions,
  scope: FeedScope,
  take: number,
) {
  const db = yield* Db;
  const config = yield* AppConfig;
  const now = yield* currentDate;
  const boundary = yield* resolveBoundary(userId, opts, scope);
  const sort = opts.sort ?? "latest";
  const readSql = readSqlFor(scope);
  const where = listFilters(scope, opts, now, boundary);
  const orderBy = keysetOrderBy(keysetColumnsFor(scope), sort);
  const limit = computeFetchWindowSize(scope === "subscribed" && Boolean(opts.feedId), take);

  return yield* db.use("articles.list.rows", (client) => {
    const base = client
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
        isRead: readSql,
        isSaved: sql<boolean>`COALESCE(${feedItemUserState.isSaved}, false)`,
        lastViewedAt: feedItemUserState.lastViewedAt,
        hiddenAt: feedItemUserState.hiddenAt,
        categories: categoryLabelsFor(config),
      })
      .from(feedItems);
    const joined =
      scope === "subscribed"
        ? base
            .innerJoin(feedSubscriptions, subscriptionJoin(userId))
            .innerJoin(feeds, eq(feedItems.feedId, feeds.id))
            .leftJoin(feedItemUserState, userStateJoin(userId))
        : base
            .innerJoin(feeds, eq(feedItems.feedId, feeds.id))
            .leftJoin(feedItemUserState, userStateJoin(userId));
    return joined
      .where(where)
      .orderBy(...orderBy)
      .limit(limit);
  });
});

const listPage = Effect.fn("articles.list.page")(function* (
  userId: string,
  opts: ListArticlesOptions,
  scope: FeedScope,
) {
  const db = yield* Db;
  const log = yield* AppLogger;
  const limit = clampLimit(opts.limit);
  const sort = opts.sort ?? "latest";

  const rows = yield* listRows(userId, opts, scope, limit + 1);
  const { hasMore, page, nextCursor, rawCount, dedupedCount } = paginateRows(rows, limit, sort);
  if (dedupedCount !== rawCount) {
    yield* log.warn("articles.list_time_dedupe.collapsed", {
      rawCount,
      dedupedCount,
      collapsedCount: rawCount - dedupedCount,
    });
  }

  const items = yield* db.use("articles.list.progress", (client) =>
    attachReadingProgress(client, userId, toArticleListItems(page)),
  );
  return {
    items,
    next_cursor: nextCursor,
    has_more: hasMore,
    total_count: null,
  } satisfies ArticlesCursorListResponseDto;
});

/** A page of the user's subscribed feed items. */
export const listArticles = (userId: string, opts: ListArticlesOptions) =>
  listPage(userId, opts, "subscribed");

/** A page of every feed item, regardless of subscription. */
export const listAllArticles = (userId: string, opts: GlobalListArticlesOptions) =>
  listPage(userId, opts, "global");
