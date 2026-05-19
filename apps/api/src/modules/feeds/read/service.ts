import { and, eq } from "drizzle-orm";
import { feedSubscriptions, feeds, folders } from "@vols.rss/db";
import type { db } from "@adapters/db/client";
import { AppError } from "@shared/errors/app-error";
import { decodeNullableText, decodeText } from "@shared/text/html-entities";
import { displayFeedTitle } from "./display-title";
import type { FeedDetailDto, SubscribedFeedListItemDto } from "../types";

type DB = typeof db;

export async function listSubscribedFeeds(
  database: DB,
  userId: string,
): Promise<SubscribedFeedListItemDto[]> {
  const rows = await database
    .select({
      subscriptionId: feedSubscriptions.id,
      feedId: feeds.id,
      url: feeds.url,
      feedTitle: feeds.title,
      customTitle: feedSubscriptions.customTitle,
      link: feeds.link,
      faviconUrl: feeds.faviconUrl,
      faviconSource: feeds.faviconSource,
      refreshStatus: feeds.refreshStatus,
      isPinned: feedSubscriptions.isPinned,
      pinnedAt: feedSubscriptions.pinnedAt,
      folderId: feedSubscriptions.folderId,
      folderName: folders.name,
      subscribedAt: feedSubscriptions.createdAt,
    })
    .from(feedSubscriptions)
    .innerJoin(feeds, eq(feedSubscriptions.feedId, feeds.id))
    .leftJoin(folders, eq(feedSubscriptions.folderId, folders.id))
    .where(eq(feedSubscriptions.userId, userId));

  return rows.map((r) => ({
    subscriptionId: r.subscriptionId,
    feedId: r.feedId,
    url: r.url,
    title: decodeText(displayFeedTitle(r.feedTitle, r.customTitle)),
    customTitle: r.customTitle,
    link: r.link,
    faviconUrl: r.faviconUrl,
    faviconSource: r.faviconSource,
    refreshStatus: r.refreshStatus,
    isPinned: r.isPinned,
    pinnedAt: r.pinnedAt ? r.pinnedAt.toISOString() : null,
    folderId: r.folderId,
    folderName: r.folderName,
    subscribedAt: r.subscribedAt.toISOString(),
  }));
}

/** Minimal rows for refresh polling — optionally scoped to a folder’s subscriptions. */
export async function listFeedRefreshStatusesForUser(
  database: DB,
  userId: string,
  folderId?: string,
): Promise<{ feedId: string; refreshStatus: string }[]> {
  const q = database
    .select({
      feedId: feeds.id,
      refreshStatus: feeds.refreshStatus,
    })
    .from(feedSubscriptions)
    .innerJoin(feeds, eq(feedSubscriptions.feedId, feeds.id))
    .where(
      folderId
        ? and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.folderId, folderId))
        : eq(feedSubscriptions.userId, userId),
    );
  const rows = await q;
  return rows.map((r) => ({ feedId: r.feedId, refreshStatus: r.refreshStatus }));
}

/** Load feed by id; include subscription fields when the current user is subscribed. */
export async function getFeedDetailForUser(
  database: DB,
  userId: string,
  feedId: string,
): Promise<FeedDetailDto> {
  const feedRows = await database
    .select({
      id: feeds.id,
      url: feeds.url,
      title: feeds.title,
      description: feeds.description,
      link: feeds.link,
      faviconUrl: feeds.faviconUrl,
      faviconSource: feeds.faviconSource,
      faviconFetchedAt: feeds.faviconFetchedAt,
      createdAt: feeds.createdAt,
      updatedAt: feeds.updatedAt,
      refreshStatus: feeds.refreshStatus,
      lastRefreshStartedAt: feeds.lastRefreshStartedAt,
      lastRefreshCompletedAt: feeds.lastRefreshCompletedAt,
      lastRefreshFailedAt: feeds.lastRefreshFailedAt,
      lastRefreshError: feeds.lastRefreshError,
      etag: feeds.etag,
      lastModified: feeds.lastModified,
      nextRefreshAt: feeds.nextRefreshAt,
    })
    .from(feeds)
    .where(eq(feeds.id, feedId))
    .limit(1);

  const feed = feedRows[0];
  if (!feed) {
    throw new AppError("Feed not found", { status: 404, code: "FEED_NOT_FOUND" });
  }

  const subRows = await database
    .select({
      id: feedSubscriptions.id,
      createdAt: feedSubscriptions.createdAt,
      customTitle: feedSubscriptions.customTitle,
      isPinned: feedSubscriptions.isPinned,
      pinnedAt: feedSubscriptions.pinnedAt,
    })
    .from(feedSubscriptions)
    .where(and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.feedId, feedId)))
    .limit(1);

  const sub = subRows[0];

  return {
    id: feed.id,
    url: feed.url,
    title: decodeText(displayFeedTitle(feed.title, sub?.customTitle)),
    customTitle: sub?.customTitle ?? null,
    description: decodeNullableText(feed.description),
    link: feed.link,
    faviconUrl: feed.faviconUrl,
    faviconSource: feed.faviconSource,
    faviconFetchedAt: feed.faviconFetchedAt ? feed.faviconFetchedAt.toISOString() : null,
    createdAt: feed.createdAt.toISOString(),
    updatedAt: feed.updatedAt.toISOString(),
    isSubscribed: Boolean(sub),
    subscriptionId: sub?.id ?? null,
    subscribedAt: sub ? sub.createdAt.toISOString() : null,
    isPinned: sub?.isPinned ?? false,
    pinnedAt: sub?.pinnedAt ? sub.pinnedAt.toISOString() : null,
    refreshStatus: feed.refreshStatus,
    lastRefreshStartedAt: feed.lastRefreshStartedAt
      ? feed.lastRefreshStartedAt.toISOString()
      : null,
    lastRefreshCompletedAt: feed.lastRefreshCompletedAt
      ? feed.lastRefreshCompletedAt.toISOString()
      : null,
    lastRefreshFailedAt: feed.lastRefreshFailedAt ? feed.lastRefreshFailedAt.toISOString() : null,
    lastRefreshError: feed.lastRefreshError,
    etag: feed.etag,
    lastModified: feed.lastModified,
    nextRefreshAt: feed.nextRefreshAt ? feed.nextRefreshAt.toISOString() : null,
  };
}
