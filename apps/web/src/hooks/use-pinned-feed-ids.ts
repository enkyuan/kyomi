"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const PINNED_FEED_IDS_QUERY_KEY = ["feeds", "pinned", "ids"] as const;
const PINNED_FEED_IDS_STORAGE_KEY = "cronos:pinned-feed-ids";

function readPinnedFeedIds() {
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

function writePinnedFeedIds(feedIds: string[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(PINNED_FEED_IDS_STORAGE_KEY, JSON.stringify(feedIds));
}

function setPinnedFeedId(currentFeedIds: string[], feedId: string, pinned: boolean) {
  const unique = [...new Set(currentFeedIds)];
  if (pinned) {
    if (unique.includes(feedId)) {
      return unique;
    }
    return [...unique, feedId];
  }
  return unique.filter((id) => id !== feedId);
}

export function usePinnedFeedIds() {
  const queryClient = useQueryClient();
  const pinnedFeedIdsQuery = useQuery({
    queryKey: PINNED_FEED_IDS_QUERY_KEY,
    staleTime: Infinity,
    queryFn: async () => readPinnedFeedIds(),
  });

  const setPinnedMutation = useMutation({
    mutationFn: async ({ feedId, pinned }: { feedId: string; pinned: boolean }) => {
      const current =
        queryClient.getQueryData<string[]>(PINNED_FEED_IDS_QUERY_KEY) ?? readPinnedFeedIds();
      const next = setPinnedFeedId(current, feedId, pinned);
      writePinnedFeedIds(next);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(PINNED_FEED_IDS_QUERY_KEY, next);
    },
  });

  const pinnedFeedIds = pinnedFeedIdsQuery.data ?? [];
  const pinnedFeedIdSet = useMemo(() => new Set(pinnedFeedIds), [pinnedFeedIds]);

  return {
    pinnedFeedIds,
    pinnedFeedIdSet,
    isPinned: (feedId: string) => pinnedFeedIdSet.has(feedId),
    setPinned: (feedId: string, pinned: boolean) => setPinnedMutation.mutate({ feedId, pinned }),
    isUpdatingPinned: setPinnedMutation.isPending,
  };
}
