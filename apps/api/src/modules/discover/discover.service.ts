import { and, eq } from "drizzle-orm";
import { feedSubscriptions, feeds } from "@cronos/db";
import type { db } from "@adapters/db/client";
import { resolveRemoteFeed } from "./discover.resolve-remote-feed";
import type { FeedPreviewDto } from "./discover.types";

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
