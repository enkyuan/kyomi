"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@integrations/better-auth/auth-provider";
import { listFollowedFeeds, type FollowedFeed, updateFeedSubscription } from "@lib/feed-functions";

const FOLLOWED_FEEDS_QUERY_KEY = ["feeds", "followed"] as const;
const PINNED_FEED_IDS_STORAGE_KEY = "cronos:pinned-feed-ids";
const PINNED_FEED_IDS_MIGRATION_KEY_PREFIX = "cronos:pinned-feed-ids:migrated:v1";
const PINNED_FEED_IDS_MIGRATION_STARTED_KEY_PREFIX = "cronos:pinned-feed-ids:migration-started:v1";

export function readLegacyPinnedFeedIds() {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  try {
    const raw = window.localStorage.getItem(PINNED_FEED_IDS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return [...new Set(parsed.map((value) => String(value).trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

export function buildMigrationKey(userId: string) {
  return `${PINNED_FEED_IDS_MIGRATION_KEY_PREFIX}:${userId}`;
}

export function buildMigrationStartedKey(userId: string) {
  return `${PINNED_FEED_IDS_MIGRATION_STARTED_KEY_PREFIX}:${userId}`;
}

function isMigrationCompleted(migrationKey: string) {
  if (typeof window === "undefined") {
    return true;
  }

  return window.localStorage.getItem(migrationKey) === "1";
}

function isMigrationStarted(startedKey: string) {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(startedKey) === "1";
}

function markMigrationStarted(startedKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(startedKey, "1");
}

function markMigrationCompleted(migrationKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  const startedKey = migrationKey.replace(
    PINNED_FEED_IDS_MIGRATION_KEY_PREFIX,
    PINNED_FEED_IDS_MIGRATION_STARTED_KEY_PREFIX,
  );
  window.localStorage.setItem(migrationKey, "1");
  window.localStorage.removeItem(startedKey);
  window.localStorage.removeItem(PINNED_FEED_IDS_STORAGE_KEY);
}

export function applyPinnedState(
  current: FollowedFeed[] | undefined,
  feedId: string,
  pinned: boolean,
) {
  if (!current) {
    return current;
  }

  return current.map((feed) =>
    feed.feedId === feedId
      ? { ...feed, isPinned: pinned, pinnedAt: pinned ? new Date().toISOString() : null }
      : feed,
  );
}

export function sortPinnedFeeds(feeds: FollowedFeed[]) {
  return feeds
    .filter((feed) => feed.isPinned)
    .sort((a, b) => {
      const aTime = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
      const bTime = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
      return bTime - aTime;
    });
}

export function usePinnedFeedIds() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const migrationRunningForKeyRef = useRef<string | null>(null);
  const followedFeedsQuery = useQuery({
    queryKey: FOLLOWED_FEEDS_QUERY_KEY,
    queryFn: () => listFollowedFeeds(),
  });

  const setPinnedMutation = useMutation({
    mutationFn: ({ feedId, pinned }: { feedId: string; pinned: boolean }) =>
      updateFeedSubscription({ data: { feedId, isPinned: pinned } }),
    onMutate: async ({ feedId, pinned }) => {
      await queryClient.cancelQueries({ queryKey: FOLLOWED_FEEDS_QUERY_KEY });
      const previous = queryClient.getQueryData<FollowedFeed[]>(FOLLOWED_FEEDS_QUERY_KEY);
      queryClient.setQueryData<FollowedFeed[] | undefined>(FOLLOWED_FEEDS_QUERY_KEY, (current) =>
        applyPinnedState(current, feedId, pinned),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(FOLLOWED_FEEDS_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: FOLLOWED_FEEDS_QUERY_KEY });
    },
  });

  useEffect(() => {
    if (!user?.id || !followedFeedsQuery.isSuccess) {
      return;
    }

    const migrationKey = buildMigrationKey(user.id);
    const migrationStartedKey = buildMigrationStartedKey(user.id);
    if (isMigrationCompleted(migrationKey) || migrationRunningForKeyRef.current === migrationKey) {
      return;
    }

    const followed = followedFeedsQuery.data;
    const serverHasPinnedFeeds = followed.some((feed) => feed.isPinned);
    const serverPinnedFeedIdSet = new Set(
      followed.filter((feed) => feed.isPinned).map((feed) => feed.feedId),
    );
    const migrationStarted = isMigrationStarted(migrationStartedKey);
    const legacyPinnedIds = readLegacyPinnedFeedIds();
    const followedFeedIdSet = new Set(followed.map((feed) => feed.feedId));
    const migratableFeedIds = [...new Set(legacyPinnedIds)]
      .filter((feedId) => followedFeedIdSet.has(feedId))
      .filter((feedId) => !serverPinnedFeedIdSet.has(feedId));

    if (!migrationStarted && serverHasPinnedFeeds) {
      markMigrationCompleted(migrationKey);
      return;
    }

    if (migratableFeedIds.length === 0) {
      markMigrationCompleted(migrationKey);
      return;
    }

    markMigrationStarted(migrationStartedKey);
    migrationRunningForKeyRef.current = migrationKey;
    void Promise.allSettled(
      migratableFeedIds.map((feedId) =>
        updateFeedSubscription({ data: { feedId, isPinned: true } }),
      ),
    ).then((results) => {
      const allSucceeded = results.every((result) => result.status === "fulfilled");
      if (allSucceeded) {
        markMigrationCompleted(migrationKey);
      }
      migrationRunningForKeyRef.current = null;
      void queryClient.invalidateQueries({ queryKey: FOLLOWED_FEEDS_QUERY_KEY });
    });
  }, [followedFeedsQuery.data, followedFeedsQuery.isSuccess, queryClient, user?.id]);

  const pinnedFeedIds = useMemo(
    () => sortPinnedFeeds(followedFeedsQuery.data ?? []).map((feed) => feed.feedId),
    [followedFeedsQuery.data],
  );
  const pinnedFeedIdSet = useMemo(() => new Set(pinnedFeedIds), [pinnedFeedIds]);

  return {
    pinnedFeedIds,
    pinnedFeedIdSet,
    isPinned: (feedId: string) => pinnedFeedIdSet.has(feedId),
    setPinned: (feedId: string, pinned: boolean) => setPinnedMutation.mutate({ feedId, pinned }),
    setPinnedAsync: (feedId: string, pinned: boolean) =>
      setPinnedMutation.mutateAsync({ feedId, pinned }),
    isUpdatingPinned: setPinnedMutation.isPending,
  };
}
