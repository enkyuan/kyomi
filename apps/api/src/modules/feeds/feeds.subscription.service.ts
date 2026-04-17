import { and, eq } from "drizzle-orm";
import { feedSubscriptions, feeds } from "@cronos/db";
import type { db } from "@adapters/db/client";
import { resolveRemoteFeed } from "@modules/discover/discover.resolve-remote-feed";
import { AppError } from "@shared/errors/app-error";
import { DEFAULT_FOLDER_NAME, getOrCreateFolderByName } from "@modules/folders/folders.service";
import { decodeText } from "@shared/text/html-entities";
import { enrichFeedFaviconIfMissing, enrichFeedFaviconMetadataBestEffort } from "./feeds.favicon";
import {
  indexFeedForSearch,
  subscribeUserToFeed,
  upsertFeedRecord,
} from "./feeds.subscription-internal";
import type { FeedSubscribeResultDto } from "./feeds.types";

type DB = typeof db;

/**
 * Fetch feed document, upsert `feeds` by canonical URL, ensure
 * `feed_subscriptions` row for user, and index for search.
 */
export async function createOrSubscribeToFeed(
  database: DB,
  userId: string,
  rawUrl: string,
): Promise<FeedSubscribeResultDto> {
  const resolved = await resolveRemoteFeed(rawUrl);

  const result = await database.transaction(async (tx) => {
    const { feedId, newFeed, shouldRefreshFavicon } = await upsertFeedRecord(tx, resolved);
    const { subscriptionId, newSubscription } = await subscribeUserToFeed(tx, userId, feedId);
    return {
      feedId,
      subscriptionId,
      url: resolved.canonicalUrl,
      title: decodeText(resolved.title),
      link: resolved.link,
      newFeed,
      newSubscription,
      shouldRefreshFavicon,
    };
  });

  if (result.shouldRefreshFavicon) {
    await enrichFeedFaviconMetadataBestEffort(database, result.feedId, result.link, result.url);
  }

  await indexFeedForSearch({
    id: result.feedId,
    url: result.url,
    title: decodeText(result.title),
    description: decodeText(resolved.description),
    link: result.link,
  });

  const { shouldRefreshFavicon: _refresh, ...subResult } = result;

  const favRow = await database
    .select({ faviconUrl: feeds.faviconUrl })
    .from(feeds)
    .where(eq(feeds.id, subResult.feedId))
    .limit(1);

  return {
    ...subResult,
    faviconUrl: favRow[0]?.faviconUrl ?? null,
  };
}

/** Subscribe to a feed row that already exists (no remote fetch). */
export async function subscribeToExistingFeed(
  database: DB,
  userId: string,
  feedId: string,
): Promise<FeedSubscribeResultDto> {
  const txResult = await database.transaction(async (tx) => {
    const now = new Date();

    const feedRow = await tx
      .select({
        id: feeds.id,
        url: feeds.url,
        title: feeds.title,
        link: feeds.link,
      })
      .from(feeds)
      .where(eq(feeds.id, feedId))
      .limit(1);

    const feed = feedRow[0];
    if (!feed) {
      throw new AppError("Feed not found", { status: 404, code: "FEED_NOT_FOUND" });
    }

    const existingSub = await tx
      .select({ id: feedSubscriptions.id })
      .from(feedSubscriptions)
      .where(and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.feedId, feedId)))
      .limit(1);

    if (existingSub[0]) {
      return {
        feedId: feed.id,
        subscriptionId: existingSub[0].id,
        url: feed.url,
        title: decodeText(feed.title),
        link: feed.link,
        newFeed: false,
        newSubscription: false,
      };
    }

    const subscriptionId = crypto.randomUUID();
    const defaultFolder = await getOrCreateFolderByName(tx, userId, DEFAULT_FOLDER_NAME);
    await tx.insert(feedSubscriptions).values({
      id: subscriptionId,
      userId,
      feedId,
      folderId: defaultFolder.id,
      createdAt: now,
    });

    return {
      feedId: feed.id,
      subscriptionId,
      url: feed.url,
      title: decodeText(feed.title),
      link: feed.link,
      newFeed: false,
      newSubscription: true,
    };
  });

  await enrichFeedFaviconIfMissing(database, txResult.feedId, txResult.link, txResult.url);

  const favRow = await database
    .select({ faviconUrl: feeds.faviconUrl })
    .from(feeds)
    .where(eq(feeds.id, txResult.feedId))
    .limit(1);

  return {
    ...txResult,
    faviconUrl: favRow[0]?.faviconUrl ?? null,
  };
}
