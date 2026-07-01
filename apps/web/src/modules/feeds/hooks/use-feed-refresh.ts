import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { getUserSafeErrorMessage, logClientError } from "@lib/errors";
import { invalidateFeedAndInboxQueries } from "@modules/inbox/queries/options";
import { getFeedDetail, refreshFeed, type FeedDetail } from "../api";
import {
  applyFeedRefreshQueued,
  getFollowedFeedsSnapshot,
  restoreFeedCacheSnapshot,
} from "../queries/cache";

export function useFeedRefresh(feedId: string) {
  const queryClient = useQueryClient();
  const previousStatusRef = useRef<string>("idle");

  const mutation = useMutation({
    mutationFn: async () => {
      // Explicit refresh action: only this mutation enqueues refresh work.
      return refreshFeed({ data: { feedId } });
    },
    onMutate: async () => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["feed-detail", feedId] }),
        queryClient.cancelQueries({ queryKey: ["feeds", "followed"] }),
      ]);
      const previousDetail = queryClient.getQueryData<FeedDetail>(["feed-detail", feedId]);
      const followedFeedsSnapshot = getFollowedFeedsSnapshot(queryClient);
      applyFeedRefreshQueued(queryClient, feedId);
      return { followedFeedsSnapshot, previousDetail };
    },
    onError: (error, _variables, context) => {
      logClientError("feeds.refresh.single", error);
      if (context?.previousDetail) {
        queryClient.setQueryData(["feed-detail", feedId], context.previousDetail);
      }
      restoreFeedCacheSnapshot(queryClient, context?.followedFeedsSnapshot);
    },
    onSuccess: () => {
      invalidateFeedAndInboxQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["feed-detail", feedId] });
    },
  });

  const { data: feedDetail } = useQuery({
    queryKey: ["feed-detail", feedId],
    queryFn: async () => {
      const data = await getFeedDetail({ data: { feedId } });
      const now = data.refreshStatus;
      const prev = previousStatusRef.current;
      if ((prev === "queued" || prev === "running") && (now === "idle" || now === "failed")) {
        setTimeout(() => {
          invalidateFeedAndInboxQueries(queryClient);
          void queryClient.invalidateQueries({ queryKey: ["feed-detail", feedId] });
        }, 0);
      }
      previousStatusRef.current = now;
      return data;
    },
    enabled: Boolean(feedId),
    refetchInterval: (query) => {
      const status = query.state?.data?.refreshStatus;
      if (status === "queued" || status === "running") {
        return 2000; // poll every 2 seconds while refreshing
      }
      return false; // only poll when a refresh is actively running
    },
  });

  const status = feedDetail?.refreshStatus ?? "idle";
  const isRefreshing = mutation.isPending || status === "queued" || status === "running";

  const triggerRefresh = () => {
    if (mutation.isPending || isRefreshing) {
      return;
    }
    mutation.mutate();
  };

  return {
    refresh: triggerRefresh,
    isRefreshing,
    refreshStatus: status,
    lastRefreshStartedAt: feedDetail?.lastRefreshStartedAt,
    lastRefreshCompletedAt: feedDetail?.lastRefreshCompletedAt,
    lastRefreshFailedAt: feedDetail?.lastRefreshFailedAt,
    error: feedDetail?.lastRefreshError
      ? getUserSafeErrorMessage(feedDetail.lastRefreshError, "Refresh failed.")
      : mutation.error
        ? getUserSafeErrorMessage(mutation.error, "Refresh failed.")
        : undefined,
  };
}
