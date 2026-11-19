import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { feedSubscriptions, feeds, folders } from "@kyomi/db";
import { Db } from "@adapters/db/service";
import { AppLogger } from "@adapters/logger/service";
import { decodeNullableText, decodeText } from "@shared/text/entities";
import { feedNotFound } from "../errors";
import { displayFeedTitle } from "./title";
import type { FeedDetailDto, SubscribedFeedListItemDto } from "../types";

const isoOrNull = (value: Date | null) => (value ? value.toISOString() : null);

export const listSubscribedFeeds = Effect.fn("feeds.read.list_subscribed")(function* (
  userId: string,
) {
  const db = yield* Db;
  const rows = yield* db.use("feeds.list_subscribed", (client) =>
    client
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
      .where(eq(feedSubscriptions.userId, userId)),
  );

  return rows.map(
    (r): SubscribedFeedListItemDto => ({
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
      pinnedAt: isoOrNull(r.pinnedAt),
      folderId: r.folderId,
      folderName: r.folderName,
      subscribedAt: r.subscribedAt.toISOString(),
    }),
  );
});

/** Minimal rows for refresh polling — optionally scoped to a folder’s subscriptions. */
export const listFeedRefreshStatusesForUser = Effect.fn("feeds.read.list_refresh_statuses")(
  function* (userId: string, folderId?: string) {
    const db = yield* Db;
    const rows = yield* db.use("feeds.list_refresh_statuses", (client) =>
      client
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
        ),
    );
    return rows.map((r) => ({ feedId: r.feedId, refreshStatus: r.refreshStatus }));
  },
);

/** Load feed by id; include subscription fields when the current user is subscribed. */
export const getFeedDetailForUser = Effect.fn("feeds.read.detail")(function* (
  userId: string,
  feedId: string,
) {
  const db = yield* Db;
  const log = yield* AppLogger;

  const feedRows = yield* db.use("feeds.detail.feed", (client) =>
    client
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
      .limit(1),
  );

  const feed = feedRows[0];
  if (!feed) {
    return yield* feedNotFound();
  }

  const subRows = yield* db.use("feeds.detail.subscription", (client) =>
    client
      .select({
        id: feedSubscriptions.id,
        createdAt: feedSubscriptions.createdAt,
        customTitle: feedSubscriptions.customTitle,
        isPinned: feedSubscriptions.isPinned,
        pinnedAt: feedSubscriptions.pinnedAt,
      })
      .from(feedSubscriptions)
      .where(and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.feedId, feedId)))
      .limit(1),
  );

  const sub = subRows[0];

  const detail: FeedDetailDto = {
    id: feed.id,
    url: feed.url,
    title: decodeText(displayFeedTitle(feed.title, sub?.customTitle)),
    customTitle: sub?.customTitle ?? null,
    description: decodeNullableText(feed.description),
    link: feed.link,
    faviconUrl: feed.faviconUrl,
    faviconSource: feed.faviconSource,
    faviconFetchedAt: isoOrNull(feed.faviconFetchedAt),
    createdAt: feed.createdAt.toISOString(),
    updatedAt: feed.updatedAt.toISOString(),
    isSubscribed: Boolean(sub),
    subscriptionId: sub?.id ?? null,
    subscribedAt: sub ? sub.createdAt.toISOString() : null,
    isPinned: sub?.isPinned ?? false,
    pinnedAt: sub ? isoOrNull(sub.pinnedAt) : null,
    refreshStatus: feed.refreshStatus,
    lastRefreshStartedAt: isoOrNull(feed.lastRefreshStartedAt),
    lastRefreshCompletedAt: isoOrNull(feed.lastRefreshCompletedAt),
    lastRefreshFailedAt: isoOrNull(feed.lastRefreshFailedAt),
    lastRefreshError: feed.lastRefreshError,
    etag: feed.etag,
    lastModified: feed.lastModified,
    nextRefreshAt: isoOrNull(feed.nextRefreshAt),
  };

  yield* log.info("feeds.detail", { userId, feedId, isSubscribed: detail.isSubscribed });
  return detail;
});
