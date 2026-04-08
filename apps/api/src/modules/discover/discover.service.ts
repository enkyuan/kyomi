import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { feedSubscriptions, feeds } from "@cronos/db";
import type { db } from "@adapters/db/client";
import { resolveRemoteFeed } from "./discover.resolve-remote-feed";
import type { FeedPreviewDto, FeedSearchResultDto } from "./discover.types";

type DB = typeof db;

export async function previewFeedFromUrl(
  database: DB,
  userId: string,
  rawUrl: string,
): Promise<FeedPreviewDto> {
  const resolved = await resolveRemoteFeed(rawUrl);

  const existingRows = await database
    .select({ id: feeds.id })
    .from(feeds)
    .where(eq(feeds.url, resolved.canonicalUrl))
    .limit(1);
  const existing = existingRows[0];

  let isSubscribed = false;
  if (existing) {
    const subRows = await database
      .select({ id: feedSubscriptions.id })
      .from(feedSubscriptions)
      .where(and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.feedId, existing.id)))
      .limit(1);
    isSubscribed = subRows.length > 0;
  }

  return {
    id: existing?.id ?? null,
    url: resolved.canonicalUrl,
    title: resolved.title,
    description: resolved.description,
    link: resolved.link,
    isSubscribed,
  };
}

export async function searchFeeds(
  database: DB,
  userId: string,
  rawQuery: string,
  limit = 20,
): Promise<FeedSearchResultDto[]> {
  const query = rawQuery.trim();
  if (!query) {
    return [];
  }

  const safeLimit = Math.min(Math.max(limit, 1), 50);
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
    .where(
      or(
        ilike(feeds.title, pattern),
        ilike(feeds.url, pattern),
        ilike(feeds.description, pattern),
        ilike(feeds.link, pattern),
      ),
    )
    .orderBy(sql`score`, asc(feeds.title))
    .limit(safeLimit);

  return rows.map(({ score: _score, ...row }) => row);
}
