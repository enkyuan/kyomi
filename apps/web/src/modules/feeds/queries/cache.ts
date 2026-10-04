"use client";

import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@lib/query/keys";
import type { DiscoverFeedResult, FollowedFeed } from "../lib/api";

export type FeedCacheSnapshot = {
  followedFeeds?: FollowedFeed[];
};

export function getFollowedFeedsSnapshot(queryClient: QueryClient): FeedCacheSnapshot {
  return {
    followedFeeds: queryClient.getQueryData<FollowedFeed[]>(queryKeys.feeds.followed),
  };
}

export function restoreFeedCacheSnapshot(queryClient: QueryClient, snapshot?: FeedCacheSnapshot) {
  if (snapshot?.followedFeeds) {
    queryClient.setQueryData(queryKeys.feeds.followed, snapshot.followedFeeds);
  }
}

function updateFollowedFeeds(
  queryClient: QueryClient,
  update: (feeds: FollowedFeed[]) => FollowedFeed[],
) {
  queryClient.setQueryData<FollowedFeed[] | undefined>(queryKeys.feeds.followed, (current) =>
    current ? update(current) : current,
  );
}

export function applyPinnedState(feeds: FollowedFeed[], feedId: string, pinned: boolean) {
  return feeds.map((feed) =>
    feed.feedId === feedId
      ? { ...feed, isPinned: pinned, pinnedAt: pinned ? new Date().toISOString() : null }
      : feed,
  );
}

export function applyPinnedFeedState(queryClient: QueryClient, feedId: string, pinned: boolean) {
  updateFollowedFeeds(queryClient, (feeds) => applyPinnedState(feeds, feedId, pinned));
}

export function markDiscoverFeedSubscribed(
  queryClient: QueryClient,
  input: { url: string; feedId?: string },
) {
  setDiscoverFeedSubscribed(queryClient, input, true);
}

export function setDiscoverFeedSubscribed(
  queryClient: QueryClient,
  input: { url: string; feedId?: string },
  isSubscribed: boolean,
) {
  queryClient.setQueriesData<DiscoverFeedResult[] | undefined>(
    { queryKey: ["discover", "feeds"] },
    (current) =>
      current?.map((item) =>
        item.url === input.url || (input.feedId ? item.id === input.feedId : false)
          ? { ...item, isSubscribed, id: item.id ?? input.feedId ?? null }
          : item,
      ),
  );
}

/** Refreshes feed, inbox, recap, and sidebar state after the followed set changes. */
export function invalidateFeedAndInboxQueries(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.feeds.followed });
  void queryClient.invalidateQueries({ queryKey: queryKeys.feeds.followedUnreadCounts });
  void queryClient.invalidateQueries({ queryKey: queryKeys.inbox.items });
  void queryClient.invalidateQueries({ queryKey: queryKeys.inbox.recap });
  void queryClient.invalidateQueries({ queryKey: queryKeys.inbox.viewCount });
  void queryClient.invalidateQueries({ queryKey: queryKeys.sidebar.inboxSummary });
}
