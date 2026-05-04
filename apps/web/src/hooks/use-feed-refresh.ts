import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { getFeedDetail, refreshFeed } from "@modules/feeds/api";
import { useEffect, useRef } from "react";

export function useFeedRefresh(feedId: string) {
  const queryClient = useQueryClient();
  const previousStatusRef = useRef<string>("idle");

  const mutation = useMutation({
    mutationFn: async () => {
      // Explicit refresh action: only this mutation enqueues refresh work.
      return refreshFeed({ data: { feedId } });
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
      queryClient.invalidateQueries({ queryKey: ["feeds", "followed"] });
      queryClient.invalidateQueries({ queryKey: ["feeds", "followed", "unread-counts"] });
      queryClient.invalidateQueries({ queryKey: ["inbox", "items"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar", "inbox-summary"] });
      queryClient.invalidateQueries({ queryKey: ["feed-detail", feedId] });
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
