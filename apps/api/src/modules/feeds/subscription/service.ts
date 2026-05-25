import { eq } from "drizzle-orm";
import { feedSubscriptions, feeds } from "@vols.rss/db";
import type { db } from "@adapters/db/client";
import { AppError } from "@shared/errors/app";
import { resolveRemoteFeed } from "@modules/discover/feed/resolve-remote";
import { resolveRemoteFeedFavicon } from "@modules/discover/feed/resolve-favicon";
import { logger } from "@adapters/logger";
import { decodeText } from "@shared/text/entities";
import type { FeedSubscribeResultDto } from "../types";
import {
  indexFeedForSearch,
  subscribeUserToFeed,
  upsertFeedRecord,
  type FaviconEnrichment,
} from "./internal";

type DB = typeof db;

function resolveImmediateFavicon(
  resolved: Awaited<ReturnType<typeof resolveRemoteFeed>>,
): FaviconEnrichment {
  const embeddedIconUrl = resolved.iconUrl?.trim();
  if (!embeddedIconUrl) {
    return null;
  }
  return { url: embeddedIconUrl, source: "feed_icon" };
}

async function enrichFaviconInBackground(
  database: DB,
  resolved: Awaited<ReturnType<typeof resolveRemoteFeed>>,
): Promise<void> {
  try {
    const enriched = await resolveRemoteFeedFavicon(resolved, logger);
    if (!enriched) {
      return;
    }

    const persisted = await database.transaction(async (tx) =>
      upsertFeedRecord(tx, resolved, enriched),
    );
    await indexFeedForSearch({
      id: persisted.feedId,
      url: resolved.canonicalUrl,
      title: decodeText(resolved.title),
      description: decodeText(resolved.description),
      link: resolved.link,
      faviconUrl: persisted.faviconUrl,
    });
  } catch (error) {
    logger.warn("feeds.favicon.enrich_background_failed", {
      url: resolved.canonicalUrl,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Fetch feed document, upsert `feeds` by canonical URL, ensure
 * `feed_subscriptions` row for user, and index for search.
 */
export async function createOrSubscribeToFeed(
  database: DB,
  userId: string,
  rawUrl: string,
  options?: { folderId?: string | null; customTitle?: string | null },
): Promise<FeedSubscribeResultDto> {
  const resolved = await resolveRemoteFeed(rawUrl);

  // Never block subscription flow on remote favicon probing.
  const favicon: FaviconEnrichment = resolveImmediateFavicon(resolved);

  const result = await database.transaction(async (tx) => {
    const { feedId, newFeed, faviconUrl, faviconSource } = await upsertFeedRecord(
      tx,
      resolved,
      favicon,
    );
    const { subscriptionId, newSubscription } = await subscribeUserToFeed(tx, userId, feedId);

    if (newSubscription && (options?.folderId || options?.customTitle !== undefined)) {
      const customTitle = options?.customTitle?.trim() || null;
      await tx
        .update(feedSubscriptions)
        .set({
          ...(options?.folderId ? { folderId: options.folderId } : {}),
          ...(options?.customTitle !== undefined ? { customTitle } : {}),
          updatedAt: new Date(),
        })
        .where(eq(feedSubscriptions.id, subscriptionId));
    }

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

  if (!result.faviconUrl || result.faviconSource === "feed_icon") {
    void enrichFaviconInBackground(database, resolved);
  }

  return result;
}

/** Subscribe to a feed row that already exists (no remote fetch). */
export async function subscribeToExistingFeed(
  database: DB,
  userId: string,
  feedId: string,
): Promise<FeedSubscribeResultDto> {
  return await database.transaction(async (tx) => {
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

    const { subscriptionId, newSubscription } = await subscribeUserToFeed(tx, userId, feed.id);

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
