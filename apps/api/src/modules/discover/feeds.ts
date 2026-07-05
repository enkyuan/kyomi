import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { feedSubscriptions, feeds } from "@kyomi/db";
import type { db } from "@adapters/db/client";
import { isMeiliConfigured, searchFeedSearchDocuments } from "@adapters/search/meili";
import type { AppLogger } from "@adapters/logger";
import { AppError } from "@shared/errors/app";
import { decodeNullableText, decodeText } from "@shared/text/entities";
import { assertHttpOrHttpsUrl, normalizeFeedUrl } from "./feed/normalize";
import { resolveRemoteFeed } from "./feed/resolve/remote";
import type { FeedPreviewDto, FeedSearchResultDto } from "./types";

type DB = typeof db;

function normalizeExistingFeedLookupUrl(rawUrl: string): string | null {
  try {
    return normalizeFeedUrl(assertHttpOrHttpsUrl(rawUrl).href);
  } catch {
    return null;
  }
}

async function previewExistingFeedByUrl(
  database: DB,
  userId: string,
  rawUrl: string,
): Promise<FeedPreviewDto | null> {
  const normalizedUrl = normalizeExistingFeedLookupUrl(rawUrl);
  if (!normalizedUrl) {
    return null;
  }

  const rows = await database
    .select({
      id: feeds.id,
      url: feeds.url,
      title: feeds.title,
      description: feeds.description,
      link: feeds.link,
      faviconUrl: feeds.faviconUrl,
      isSubscribed: sql<boolean>`CASE WHEN ${feedSubscriptions.id} IS NULL THEN false ELSE true END`,
    })
    .from(feeds)
    .leftJoin(
      feedSubscriptions,
      and(eq(feedSubscriptions.feedId, feeds.id), eq(feedSubscriptions.userId, userId)),
    )
    .where(eq(feeds.url, normalizedUrl))
    .limit(1);
  const existing = rows[0];
  if (!existing) {
    return null;
  }

  return {
    id: existing.id,
    url: existing.url,
    title: decodeText(existing.title),
    description: decodeNullableText(existing.description) ?? "",
    link: existing.link,
    faviconUrl: existing.faviconUrl,
    isSubscribed: existing.isSubscribed,
  };
}

export async function previewFeedFromUrl(
  database: DB,
  userId: string,
  rawUrl: string,
): Promise<FeedPreviewDto> {
  const existingPreview = await previewExistingFeedByUrl(database, userId, rawUrl);
  if (existingPreview) {
    return existingPreview;
  }

  const resolved = await resolveRemoteFeed(rawUrl);

  const existingRows = await database
    .select({ id: feeds.id, faviconUrl: feeds.faviconUrl })
    .from(feeds)
    .where(eq(feeds.url, resolved.canonicalUrl))
    .limit(1);
  const existingFeed = existingRows[0];

  let isSubscribed = false;
  if (existingFeed) {
    const subRows = await database
      .select({ id: feedSubscriptions.id })
      .from(feedSubscriptions)
      .where(
        and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.feedId, existingFeed.id)),
      )
      .limit(1);
    isSubscribed = subRows.length > 0;
  }

  // Keep preview snappy: avoid blocking on remote favicon probing.
  const favicon = existingFeed?.faviconUrl ?? resolved.iconUrl ?? null;

  return {
    id: existingFeed?.id ?? null,
    url: resolved.canonicalUrl,
    title: decodeText(resolved.title),
    description: decodeText(resolved.description),
    link: resolved.link,
    faviconUrl: favicon,
    isSubscribed,
  };
}

export async function searchFeeds(
  database: DB,
  userId: string,
  rawQuery: string,
  limit = 20,
  logger?: AppLogger,
): Promise<FeedSearchResultDto[]> {
  const query = rawQuery.trim();
  if (!query) {
    return [];
  }

  const safeLimit = Math.min(Math.max(limit, 1), 50);
  if (isMeiliConfigured()) {
    try {
      const hits = await searchFeedSearchDocuments(query, safeLimit);
      if (hits.length === 0) {
        return [];
      }
      const hitIds = hits.map((hit) => hit.id);
      const rows = await database
        .select({
          id: feeds.id,
          url: feeds.url,
          title: feeds.title,
          description: feeds.description,
          link: feeds.link,
          faviconUrl: feeds.faviconUrl,
          isSubscribed: sql<boolean>`CASE WHEN ${feedSubscriptions.id} IS NULL THEN false ELSE true END`,
        })
        .from(feeds)
        .leftJoin(
          feedSubscriptions,
          and(eq(feedSubscriptions.feedId, feeds.id), eq(feedSubscriptions.userId, userId)),
        )
        .where(inArray(feeds.id, hitIds));
      const rowsById = new Map(rows.map((row) => [row.id, row]));
      const results = hits.map((hit) => {
        const row = rowsById.get(hit.id);
        if (!row) {
          return {
            id: null,
            url: hit.url,
            title: decodeText(hit.title),
            description: decodeNullableText(hit.description),
            link: hit.link,
            faviconUrl: hit.faviconUrl ?? null,
            isSubscribed: false,
          };
        }
        return {
          id: row.id,
          url: row.url,
          title: decodeText(row.title),
          description: decodeNullableText(row.description),
          link: row.link,
          faviconUrl: row.faviconUrl ?? null,
          isSubscribed: row.isSubscribed,
        };
      });
      const staleHitCount = hits.reduce(
        (count, hit) => (rowsById.has(hit.id) ? count : count + 1),
        0,
      );
      if (staleHitCount > 0) {
        logger?.warn("discover.search.meili_stale_hits", {
          userId,
          query,
          limit: safeLimit,
          staleHitCount,
        });
      }
      return results;
    } catch (error) {
      logger?.warn("discover.search.meili_fallback", {
        userId,
        query,
        limit: safeLimit,
        error: error instanceof Error ? error.message : String(error),
        errorCode: error instanceof AppError ? error.code : undefined,
      });
      return [];
    }
  }

  const pattern = `%${query}%`;
  const subscriptionJoin = and(
    eq(feedSubscriptions.feedId, feeds.id),
    eq(feedSubscriptions.userId, userId),
  );

  const rows = await database
    .select({
      id: feeds.id,
      url: feeds.url,
      title: feeds.title,
      description: feeds.description,
      link: feeds.link,
      faviconUrl: feeds.faviconUrl,
      isSubscribed: sql<boolean>`CASE WHEN ${feedSubscriptions.id} IS NULL THEN false ELSE true END`,
      score: sql<number>`
        CASE
          WHEN lower(${feeds.title}) = lower(${query}) THEN 0
          WHEN lower(${feeds.url}) = lower(${query}) THEN 1
          WHEN ${feedSubscriptions.id} IS NOT NULL THEN 2
          WHEN lower(${feeds.title}) LIKE lower(${pattern}) THEN 3
          ELSE 4
        END
      `,
    })
    .from(feeds)
    .leftJoin(feedSubscriptions, subscriptionJoin)
    .where(or(ilike(feeds.title, pattern), ilike(feeds.url, pattern)))
    .orderBy(sql`score`, asc(feeds.title))
    .limit(safeLimit);

  return rows.map(({ score: _score, ...row }) => ({
    ...row,
    title: decodeText(row.title),
    description: decodeNullableText(row.description),
    faviconUrl: row.faviconUrl,
  }));
}
