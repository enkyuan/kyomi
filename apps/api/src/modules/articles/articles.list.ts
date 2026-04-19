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
  const dedupedRows = collapseObviousDuplicates(rows);
  const hasMore = dedupedRows.length > limit;
  const page = hasMore ? dedupedRows.slice(0, limit) : dedupedRows;
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

  const rows = await listArticleRows(database, userId, opts, limit + 1);
  const { hasMore, page, nextCursor } = paginateRows(rows, limit);

  const items = toArticleListItems(page);
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

// Keep this normalization aligned with ingestion identity rules:
// same-feed links that differ only by tracking params/hash/trailing slash are one article.
export function normalizedArticleIdentity(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || key === "fbclid" || key === "gclid" || key === "mc_cid") {
        url.searchParams.delete(key);
      }
    }
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.href;
  } catch {
    return rawUrl;
  }
}

function rowRichnessScore(row: RawRow): number {
  const summaryScore = row.summary?.trim() ? 2 : 0;
  const titleScore = row.title.trim().length >= 6 ? 1 : 0;
  return summaryScore + titleScore;
}

function shouldPreferRow(candidate: RawRow, current: RawRow): boolean {
  const candidateScore = rowRichnessScore(candidate);
  const currentScore = rowRichnessScore(current);
  if (candidateScore !== currentScore) {
    return candidateScore > currentScore;
  }
  if (candidate.publishedAt.getTime() !== current.publishedAt.getTime()) {
    return candidate.publishedAt.getTime() > current.publishedAt.getTime();
  }
  return candidate.id > current.id;
}

export function collapseObviousDuplicates(rows: RawRow[]): RawRow[] {
  // Defensive dedupe for historical ingest artifacts: collapse same-feed items with
  // equivalent canonical links and keep the richer/newer row.
  const deduped = new Map<string, RawRow>();
  for (const row of rows) {
    const key = `${row.feedId}|${normalizedArticleIdentity(row.link)}`;
    const existing = deduped.get(key);
    if (!existing || shouldPreferRow(row, existing)) {
      deduped.set(key, row);
    }
  }
  return [...deduped.values()].sort((a, b) => {
    const publishedDiff = b.publishedAt.getTime() - a.publishedAt.getTime();
    if (publishedDiff !== 0) {
      return publishedDiff;
    }
    if (a.id === b.id) {
      return 0;
    }
    return a.id < b.id ? 1 : -1;
  });
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
): Promise<RawRow[]> {
  const { feedSubscriptionsJoin, userStateJoin } = baseJoins(userId);

  const filters: SQL[] = [];
  pushBaseFilters(filters, opts);
  pushReadSavedFilters(filters, opts);
  pushPublishedDateFilters(filters, opts);
  await pushCursorFilter(database, userId, opts, feedSubscriptionsJoin, filters);

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
    .limit(Math.min(800, take * 3));
}
