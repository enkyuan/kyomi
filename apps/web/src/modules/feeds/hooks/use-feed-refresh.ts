import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { invalidateFeedAndInboxQueries } from "@modules/inbox/lib/query-options";
import { getFeedDetail, refreshFeed } from "../services/api";

export function useFeedRefresh(feedId: string) {
  const queryClient = useQueryClient();
  const previousStatusRef = useRef<string>("idle");

  const mutation = useMutation({
    mutationFn: async () => {
      // Explicit refresh action: only this mutation enqueues refresh work.
      return refreshFeed({ data: { feedId } });
    },
    onSuccess: () => {
      invalidateFeedAndInboxQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["feed-detail", feedId] });
    },
  });

  const detailQuery = useQuery({
    queryKey: ["feed-detail", feedId],
    queryFn: () => getFeedDetail({ data: { feedId } }),
    enabled: Boolean(feedId),
    refetchInterval: (query) => {
      const status = query.state?.data?.refreshStatus;
      if (status === "queued" || status === "running") {
        return 2000; // poll every 2 seconds while refreshing
      }
      return false; // only poll when a refresh is actively running
    },
  });

  const status = detailQuery.data?.refreshStatus ?? "idle";
  const isRefreshing = mutation.isPending || status === "queued" || status === "running";

  // Reset status tracking when the monitored feed changes so a stale previous status from
  // one feed cannot trigger invalidations for a different feed.
  useEffect(() => {
    previousStatusRef.current = "idle";
  }, [feedId]);

  useEffect(() => {
    const prev = previousStatusRef.current;
    const now = status;
    if ((prev === "queued" || prev === "running") && (now === "idle" || now === "failed")) {
      // Worker transitioned to a terminal state; refetch read models now.
      invalidateFeedAndInboxQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["feed-detail", feedId] });
    }
    previousStatusRef.current = now;
  }, [status, feedId, queryClient]);

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
    lastRefreshStartedAt: detailQuery.data?.lastRefreshStartedAt,
    lastRefreshCompletedAt: detailQuery.data?.lastRefreshCompletedAt,
    lastRefreshFailedAt: detailQuery.data?.lastRefreshFailedAt,
    error: detailQuery.data?.lastRefreshError ?? mutation.error?.message,
  };
}
