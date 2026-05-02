import { and, eq } from "drizzle-orm";
import { feedSubscriptions, feeds } from "@cronos/db";
import type { db } from "@adapters/db/client";
import { logger } from "@adapters/logger";
import { upsertFeedSearchDocument } from "@adapters/search/meili";
import { resolveRemoteFeed } from "@modules/discover/resolve-remote-feed";
import { DEFAULT_FOLDER_NAME, getOrCreateFolderByName } from "@modules/folders/service";

type DB = typeof db;

export type FaviconEnrichment = { url: string; source: string } | null;

function faviconSourceRank(source: string | null): number {
  switch (source) {
    case "html_link":
    case "feed_icon":
      return 3;
    case "google_s2":
    case "duckduckgo":
      return 2;
    case "favicon_ico":
      return 1;
    default:
      return 0;
  }
}

/**
 * Upsert the global `feeds` row by canonical URL. Returns the feed ID and
 * whether a new row was inserted.
 */
export async function upsertFeedRecord(
  tx: Parameters<Parameters<DB["transaction"]>[0]>[0],
  resolved: Awaited<ReturnType<typeof resolveRemoteFeed>>,
  favicon: FaviconEnrichment,
): Promise<{
  feedId: string;
  newFeed: boolean;
  faviconUrl: string | null;
  faviconSource: string | null;
}> {
  const now = new Date();

  const existingFeed = await tx
    .select({
      id: feeds.id,
      link: feeds.link,
      faviconUrl: feeds.faviconUrl,
      faviconSource: feeds.faviconSource,
    })
    .from(feeds)
    .where(eq(feeds.url, resolved.canonicalUrl))
    .limit(1);

  if (existingFeed[0]) {
    const linkChanged = (existingFeed[0].link ?? "") !== (resolved.link ?? "");
    const hasBetterFavicon =
      faviconSourceRank(favicon?.source ?? null) > faviconSourceRank(existingFeed[0].faviconSource);
    const shouldApplyFavicon =
      favicon && (!existingFeed[0].faviconUrl || linkChanged || hasBetterFavicon);

    await tx
      .update(feeds)
      .set({
        title: resolved.title,
        description: resolved.description,
        link: resolved.link,
        updatedAt: now,
        ...(shouldApplyFavicon
          ? {
              faviconUrl: favicon!.url,
              faviconSource: favicon!.source,
              faviconFetchedAt: now,
            }
          : {}),
      })
      .where(eq(feeds.id, existingFeed[0].id));

    const [final] = await tx
      .select({ faviconUrl: feeds.faviconUrl, faviconSource: feeds.faviconSource })
      .from(feeds)
      .where(eq(feeds.id, existingFeed[0].id))
      .limit(1);

    return {
      feedId: existingFeed[0].id,
      newFeed: false,
      faviconUrl: final?.faviconUrl ?? null,
      faviconSource: final?.faviconSource ?? null,
    };
  }

  const feedId = crypto.randomUUID();
  await tx.insert(feeds).values({
    id: feedId,
    url: resolved.canonicalUrl,
    title: resolved.title,
    description: resolved.description,
    link: resolved.link,
    createdAt: now,
    updatedAt: now,
    faviconUrl: favicon?.url ?? null,
    faviconSource: favicon?.source ?? null,
    faviconFetchedAt: favicon ? now : null,
  });

  return {
    feedId,
    newFeed: true,
    faviconUrl: favicon?.url ?? null,
    faviconSource: favicon?.source ?? null,
  };
}

/**
 * Ensure a `feed_subscriptions` row exists for the user. Creates the default
 * folder if needed.
 */
export async function subscribeUserToFeed(
  tx: Parameters<Parameters<DB["transaction"]>[0]>[0],
  userId: string,
  feedId: string,
): Promise<{ subscriptionId: string; newSubscription: boolean }> {
  const existingSub = await tx
    .select({ id: feedSubscriptions.id })
    .from(feedSubscriptions)
    .where(and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.feedId, feedId)))
    .limit(1);

  if (existingSub[0]) {
    return { subscriptionId: existingSub[0].id, newSubscription: false };
  }

  const subscriptionId = crypto.randomUUID();
  const defaultFolder = await getOrCreateFolderByName(tx, userId, DEFAULT_FOLDER_NAME);
  await tx.insert(feedSubscriptions).values({
    id: subscriptionId,
    userId,
    feedId,
    folderId: defaultFolder.id,
    createdAt: new Date(),
  });
  return { subscriptionId, newSubscription: true };
}

/**
 * Index the feed in the search engine. Logs errors instead of silently
 * swallowing them so search indexing failures are visible in telemetry.
 */
export async function indexFeedForSearch(metadata: {
  id: string;
  url: string;
  title: string;
  description: string | null;
  link: string | null;
  faviconUrl?: string | null;
}): Promise<void> {
  try {
    await upsertFeedSearchDocument(metadata);
  } catch (error) {
    logger.warn("feeds.search_index.failed", {
      feedId: metadata.id,
      url: metadata.url,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
