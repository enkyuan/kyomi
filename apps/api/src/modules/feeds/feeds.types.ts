export type SubscribedFeedListItemDto = {
  subscriptionId: string;
  feedId: string;
  url: string;
  /** Resolved display title (`customTitle` if set, else global feed title). */
  title: string;
  /** Raw override; null means use global feed title. */
  customTitle: string | null;
  link: string | null;
  /** Persisted favicon URL when enrichment succeeded; null if unset. */
  faviconUrl: string | null;
  folderId: string | null;
  folderName: string | null;
  subscribedAt: string;
};

export type SubscribedFeedsResponseDto = {
  items: SubscribedFeedListItemDto[];
};

/** Response for `POST /feeds` and `POST /feeds/:feedId/subscribe`. */
export type FeedSubscribeResultDto = {
  feedId: string;
  subscriptionId: string;
  url: string;
  title: string;
  link: string | null;
  /** Persisted favicon URL after best-effort enrichment. */
  faviconUrl: string | null;
  /** Inserted a new row in `feeds` (first subscriber globally for this URL). */
  newFeed: boolean;
  /** Inserted a new row in `feed_subscriptions` for this user. */
  newSubscription: boolean;
};

/** `GET /feeds/:feedId` — global feed row plus caller’s subscription state. */
export type FeedDetailDto = {
  id: string;
  url: string;
  /** Display title (custom override or global). */
  title: string;
  /** Stored override; null when using global title. */
  customTitle: string | null;
  description: string | null;
  link: string | null;
  faviconUrl: string | null;
  faviconSource: string | null;
  faviconFetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isSubscribed: boolean;
  subscriptionId: string | null;
  subscribedAt: string | null;
  refreshStatus: string;
  lastRefreshCompletedAt: string | null;
  lastRefreshFailedAt: string | null;
  lastRefreshError: string | null;
  nextRefreshAt: string | null;
};

export type MessageResponseDto = {
  message: string;
};

export type BulkUnsubscribeResponseDto = MessageResponseDto & {
  removedCount: number;
};

export type BulkMoveFeedsResponseDto = {
  updatedCount: number;
};

export type UpdateFeedSubscriptionBody = {
  /** Omit field to leave unchanged; `null` clears override. */
  customTitle?: string | null;
};

/** `PUT /feeds/:feedId/admin` — global `feeds` row (platform admin allowlist only). */
export type AdminUpdateGlobalFeedBody = {
  title?: string;
  description?: string | null;
  link?: string | null;
  url?: string;
};

export type AdminGlobalFeedDetailDto = {
  id: string;
  url: string;
  title: string;
  description: string | null;
  link: string | null;
  createdAt: string;
  updatedAt: string;
};
