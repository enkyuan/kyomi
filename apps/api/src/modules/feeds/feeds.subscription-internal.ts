import { and, eq } from "drizzle-orm";
import { feedSubscriptions, feeds } from "@cronos/db";
import type { db } from "@adapters/db/client";
import { logger } from "@adapters/logger";
import { upsertFeedSearchDocument } from "@adapters/search/meili";
import { DEFAULT_FOLDER_NAME, getOrCreateFolderByName } from "@modules/folders/folders.service";
import { resolveRemoteFeed } from "@modules/discover/discover.resolve-remote-feed";
import { normalizeComparableUrl } from "./feeds.favicon";

type DB = typeof db;
type Transaction = Parameters<Parameters<DB["transaction"]>[0]>[0];

/**
 * Upsert the global `feeds` row by canonical URL. Returns the feed ID and
 * whether a new row was inserted.
 */
export async function upsertFeedRecord(
  tx: Transaction,
  resolved: Awaited<ReturnType<typeof resolveRemoteFeed>>,
): Promise<{ feedId: string; newFeed: boolean; shouldRefreshFavicon: boolean }> {
  const now = new Date();

  const existingFeed = await tx
    .select({ id: feeds.id })
    .from(feeds)
    .where(eq(feeds.url, resolved.canonicalUrl))
    .limit(1);

  if (existingFeed[0]) {
    const priorRows = await tx
      .select({ link: feeds.link, faviconUrl: feeds.faviconUrl })
      .from(feeds)
      .where(eq(feeds.id, existingFeed[0].id))
      .limit(1);
    const prior = priorRows[0];
    const linkChanged =
      normalizeComparableUrl(prior?.link ?? null) !== normalizeComparableUrl(resolved.link);
    const shouldRefreshFavicon = !prior?.faviconUrl || linkChanged;

    await tx
      .update(feeds)
      .set({
        title: resolved.title,
        description: resolved.description,
        link: resolved.link,
        updatedAt: now,
      })
      .where(eq(feeds.id, existingFeed[0].id));
    return { feedId: existingFeed[0].id, newFeed: false, shouldRefreshFavicon };
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
  });
  return { feedId, newFeed: true, shouldRefreshFavicon: true };
}

/**
 * Ensure a `feed_subscriptions` row exists for the user. Creates the default
 * folder if needed.
 */
export async function subscribeUserToFeed(
  tx: Transaction,
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
