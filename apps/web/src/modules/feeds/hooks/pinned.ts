"use client";

/**
 * Pin state is persisted on the server (`feed_subscriptions.is_pinned` / `pinned_at`).
 * localStorage keys below exist only for one-time migration from a legacy client-only list.
 */

import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@integrations/better-auth/provider";
import { listFollowedFeeds, type FollowedFeed, updateFeedSubscription } from "../api";
import {
  applyPinnedFeedState,
  applyPinnedState,
  getFollowedFeedsSnapshot,
  restoreFeedCacheSnapshot,
} from "../queries/cache";

export { applyPinnedState };

const FOLLOWED_FEEDS_QUERY_KEY = ["feeds", "followed"] as const;
const PINNED_FEED_IDS_STORAGE_KEY = "kyomi:pinned-feed-ids";
const PINNED_FEED_IDS_MIGRATION_KEY_PREFIX = "kyomi:pinned-feed-ids:migrated:v1";
const PINNED_FEED_IDS_MIGRATION_STARTED_KEY_PREFIX = "kyomi:pinned-feed-ids:migration-started:v1";

function readLegacyPinnedFeedIds() {
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
    return [
      ...new Set(
        parsed.flatMap((value) => {
          const trimmed = String(value).trim();
          return trimmed ? [trimmed] : [];
        }),
      ),
    ];
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

function logPinnedMigration(event: "attempted" | "succeeded" | "failed" | "skipped", context = {}) {
  if (typeof console === "undefined") {
    return;
  }

  console.info("[pinned-feed-migration]", { event, ...context });
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
  const { data: followedFeedsData, isSuccess: isFollowedFeedsSuccess } = useQuery({
    queryKey: FOLLOWED_FEEDS_QUERY_KEY,
    queryFn: () => listFollowedFeeds(),
  });

  const setPinnedMutation = useMutation({
    mutationFn: ({ feedId, pinned }: { feedId: string; pinned: boolean }) =>
      updateFeedSubscription({ data: { feedId, isPinned: pinned } }),
    onMutate: async ({ feedId, pinned }) => {
      await queryClient.cancelQueries({ queryKey: FOLLOWED_FEEDS_QUERY_KEY });
      const snapshot = getFollowedFeedsSnapshot(queryClient);
      applyPinnedFeedState(queryClient, feedId, pinned);
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      restoreFeedCacheSnapshot(queryClient, context?.snapshot);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: FOLLOWED_FEEDS_QUERY_KEY });
    },
  });

  useEffect(() => {
    if (!user?.id || !isFollowedFeedsSuccess) {
      return;
    }

    const migrationKey = buildMigrationKey(user.id);
    const migrationStartedKey = buildMigrationStartedKey(user.id);
    if (isMigrationCompleted(migrationKey) || migrationRunningForKeyRef.current === migrationKey) {
      return;
    }

    const followed = followedFeedsData;
    const serverHasPinnedFeeds = followed.some((feed) => feed.isPinned);
    const serverPinnedFeedIdSet = new Set(
      followed.flatMap((feed) => (feed.isPinned ? [feed.feedId] : [])),
    );
    const migrationStarted = isMigrationStarted(migrationStartedKey);
    const legacyPinnedIds = readLegacyPinnedFeedIds();
    const followedFeedIdSet = new Set(followed.map((feed) => feed.feedId));
    const migratableFeedIds = [...new Set(legacyPinnedIds)].filter(
      (feedId) => followedFeedIdSet.has(feedId) && !serverPinnedFeedIdSet.has(feedId),
    );

    if (!migrationStarted && serverHasPinnedFeeds) {
      logPinnedMigration("skipped", { reason: "server_already_has_pinned_feeds" });
      markMigrationCompleted(migrationKey);
      return;
    }

    if (migratableFeedIds.length === 0) {
      logPinnedMigration("skipped", { reason: "no_migratable_feed_ids" });
      markMigrationCompleted(migrationKey);
      return;
    }

    logPinnedMigration("attempted", { count: migratableFeedIds.length });
    markMigrationStarted(migrationStartedKey);
    migrationRunningForKeyRef.current = migrationKey;
    void Promise.allSettled(
      migratableFeedIds.map((feedId) =>
        updateFeedSubscription({ data: { feedId, isPinned: true } }),
      ),
    ).then((results) => {
      const allSucceeded = results.every((result) => result.status === "fulfilled");
      if (allSucceeded) {
        logPinnedMigration("succeeded", { count: migratableFeedIds.length });
        markMigrationCompleted(migrationKey);
      } else {
        logPinnedMigration("failed", {
          count: migratableFeedIds.length,
          failedCount: results.filter((result) => result.status === "rejected").length,
        });
      }
      migrationRunningForKeyRef.current = null;
      void queryClient.invalidateQueries({ queryKey: FOLLOWED_FEEDS_QUERY_KEY });
    });
  }, [followedFeedsData, isFollowedFeedsSuccess, queryClient, user?.id]);

  const pinnedFeedIds = useMemo(
    () => sortPinnedFeeds(followedFeedsData ?? []).map((feed) => feed.feedId),
    [followedFeedsData],
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
