import { t } from "elysia";

export const feedSubscribeResult = t.Object({
  feedId: t.String(),
  subscriptionId: t.String(),
  url: t.String(),
  title: t.String(),
  link: t.Union([t.String(), t.Null()]),
  faviconUrl: t.Union([t.String(), t.Null()]),
  faviconSource: t.Union([t.String(), t.Null()]),
  newFeed: t.Boolean(),
  newSubscription: t.Boolean(),
});

export const feedDetailResponse = t.Object({
  id: t.String(),
  url: t.String(),
  title: t.String(),
  customTitle: t.Union([t.String(), t.Null()]),
  description: t.Union([t.String(), t.Null()]),
  link: t.Union([t.String(), t.Null()]),
  faviconUrl: t.Union([t.String(), t.Null()]),
  faviconSource: t.Union([t.String(), t.Null()]),
  faviconFetchedAt: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
  updatedAt: t.String(),
  isSubscribed: t.Boolean(),
  subscriptionId: t.Union([t.String(), t.Null()]),
  subscribedAt: t.Union([t.String(), t.Null()]),
  isPinned: t.Boolean(),
  pinnedAt: t.Union([t.String(), t.Null()]),
  refreshStatus: t.String(),
  lastRefreshStartedAt: t.Union([t.String(), t.Null()]),
  lastRefreshCompletedAt: t.Union([t.String(), t.Null()]),
  lastRefreshFailedAt: t.Union([t.String(), t.Null()]),
  lastRefreshError: t.Union([t.String(), t.Null()]),
  etag: t.Union([t.String(), t.Null()]),
  lastModified: t.Union([t.String(), t.Null()]),
  nextRefreshAt: t.Union([t.String(), t.Null()]),
});

export const messageResponse = t.Object({
  message: t.String(),
});

export const adminGlobalFeedDetail = t.Object({
  id: t.String(),
  url: t.String(),
  title: t.String(),
  description: t.Union([t.String(), t.Null()]),
  link: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export const bulkUnsubscribeResponse = t.Object({
  message: t.String(),
  removedCount: t.Number(),
});

export const bulkMoveFeedsResponse = t.Object({
  updatedCount: t.Number(),
});

export const subscribeFeedsByUrlBody = t.Object({
  url: t.String({ minLength: 1 }),
});

export const unsubscribeBulkBody = t.Object({
  feedIds: t.Array(t.String({ format: "uuid" }), { minItems: 1 }),
});

export const moveFeedsBulkBody = t.Object({
  feedIds: t.Array(t.String({ format: "uuid" }), { minItems: 1 }),
  folderId: t.String({ format: "uuid" }),
});

export const subscribedFeedItem = t.Object({
  subscriptionId: t.String(),
  feedId: t.String(),
  url: t.String(),
  title: t.String(),
  customTitle: t.Union([t.String(), t.Null()]),
  link: t.Union([t.String(), t.Null()]),
  faviconUrl: t.Union([t.String(), t.Null()]),
  faviconSource: t.Union([t.String(), t.Null()]),
  refreshStatus: t.String(),
  isPinned: t.Boolean(),
  pinnedAt: t.Union([t.String(), t.Null()]),
  folderId: t.Union([t.String(), t.Null()]),
  folderName: t.Union([t.String(), t.Null()]),
  subscribedAt: t.String(),
});

export const subscribedFeedsListResponse = t.Object({
  items: t.Array(subscribedFeedItem),
});

export const feedRefreshStatusRow = t.Object({
  feedId: t.String(),
  refreshStatus: t.String(),
});

export const feedRefreshStatusListResponse = t.Object({
  items: t.Array(feedRefreshStatusRow),
});

export const updateFeedSubscriptionBody = t.Object({
  customTitle: t.Optional(t.Union([t.String(), t.Null()])),
  isPinned: t.Optional(t.Boolean()),
});

export const adminUpdateGlobalFeedBody = t.Object({
  title: t.Optional(t.String()),
  description: t.Optional(t.Union([t.String(), t.Null()])),
  link: t.Optional(t.Union([t.String(), t.Null()])),
  url: t.Optional(t.String()),
});
