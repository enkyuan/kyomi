import { and, eq } from "drizzle-orm";
import { feedSubscriptions, feeds } from "@cronos/db";
import type { db } from "@adapters/db/client";
import { AppError } from "@shared/errors/app-error";
import { resolveRemoteFeed } from "@modules/discover/resolve-remote-feed";
import { resolveRemoteFeedFavicon } from "@modules/discover/resolve-feed-favicon";
import { logger } from "@adapters/logger";
import { decodeText } from "@shared/text/html-entities";
import { DEFAULT_FOLDER_NAME, getOrCreateFolderByName } from "@modules/folders/service";
import type { FeedSubscribeResultDto } from "../types";
import {
  indexFeedForSearch,
  subscribeUserToFeed,
  upsertFeedRecord,
  type FaviconEnrichment,
} from "./internal";

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

  const favicon: FaviconEnrichment = await resolveRemoteFeedFavicon(resolved, logger);

  const result = await database.transaction(async (tx) => {
    const { feedId, newFeed, faviconUrl, faviconSource } = await upsertFeedRecord(
      tx,
      resolved,
      favicon,
    );
    const { subscriptionId, newSubscription } = await subscribeUserToFeed(tx, userId, feedId);
    return {
      feedId,
      subscriptionId,
      url: resolved.canonicalUrl,
      title: decodeText(resolved.title),
      link: resolved.link,
      faviconUrl,
      faviconSource,
      newFeed,
      newSubscription,
    };
  });

  await indexFeedForSearch({
    id: result.feedId,
    url: result.url,
    title: decodeText(result.title),
    description: decodeText(resolved.description),
    link: result.link,
    faviconUrl: result.faviconUrl,
  });

  return result;
}

/** Subscribe to a feed row that already exists (no remote fetch). */
export async function subscribeToExistingFeed(
  database: DB,
  userId: string,
  feedId: string,
): Promise<FeedSubscribeResultDto> {
  return await database.transaction(async (tx) => {
    const now = new Date();

    const feedRow = await tx
      .select({
        id: feeds.id,
        url: feeds.url,
        title: feeds.title,
        link: feeds.link,
        faviconUrl: feeds.faviconUrl,
        faviconSource: feeds.faviconSource,
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
        faviconUrl: feed.faviconUrl,
        faviconSource: feed.faviconSource,
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
      faviconUrl: feed.faviconUrl,
      faviconSource: feed.faviconSource,
      newFeed: false,
      newSubscription: true,
    };
  });
}
