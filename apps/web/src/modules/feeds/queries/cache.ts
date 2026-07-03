"use client";

import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { DiscoverFeedResult, FollowedFeed } from "../api";
import { followedFeedsQueryKey } from "@modules/inbox/queries/options";

export type FeedCacheSnapshot = {
  followedFeeds?: FollowedFeed[];
};

export type DiscoverFeedsSnapshot = Array<readonly [QueryKey, DiscoverFeedResult[] | undefined]>;

export function getFollowedFeedsSnapshot(queryClient: QueryClient): FeedCacheSnapshot {
  return {
    followedFeeds: queryClient.getQueryData<FollowedFeed[]>(followedFeedsQueryKey()),
  };
}

export function restoreFeedCacheSnapshot(queryClient: QueryClient, snapshot?: FeedCacheSnapshot) {
  if (snapshot?.followedFeeds) {
    queryClient.setQueryData(followedFeedsQueryKey(), snapshot.followedFeeds);
  }
}

function updateFollowedFeeds(
  queryClient: QueryClient,
  update: (feeds: FollowedFeed[]) => FollowedFeed[],
) {
  queryClient.setQueryData<FollowedFeed[] | undefined>(followedFeedsQueryKey(), (current) =>
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

export function applyFeedFolder(
  queryClient: QueryClient,
  feedId: string,
  folder: { id: string; name?: string },
) {
  updateFollowedFeeds(queryClient, (feeds) =>
    feeds.map((feed) =>
      feed.feedId === feedId
        ? { ...feed, folderId: folder.id, folderName: folder.name ?? feed.folderName }
        : feed,
    ),
  );
}

export function removeFollowedFeeds(queryClient: QueryClient, feedIds: string[]) {
  const deletedFeedIdSet = new Set(feedIds);
  updateFollowedFeeds(queryClient, (feeds) =>
    feeds.filter((feed) => !deletedFeedIdSet.has(feed.feedId)),
  );
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

export function getDiscoverFeedsSnapshot(queryClient: QueryClient): DiscoverFeedsSnapshot {
  return queryClient.getQueriesData<DiscoverFeedResult[]>({ queryKey: ["discover", "feeds"] });
}

export function restoreDiscoverFeedsSnapshot(
  queryClient: QueryClient,
  snapshot?: DiscoverFeedsSnapshot,
) {
  for (const [queryKey, data] of snapshot ?? []) {
    queryClient.setQueryData(queryKey, data);
  }
}
