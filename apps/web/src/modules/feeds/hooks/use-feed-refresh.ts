import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { invalidateFeedAndInboxQueries } from "@modules/inbox/queries/options";
import { getFeedDetail, refreshFeed } from "../api";

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

  const status = detailQuery.data?.refreshStatus ?? "idle";
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
    lastRefreshStartedAt: detailQuery.data?.lastRefreshStartedAt,
    lastRefreshCompletedAt: detailQuery.data?.lastRefreshCompletedAt,
    lastRefreshFailedAt: detailQuery.data?.lastRefreshFailedAt,
    error: detailQuery.data?.lastRefreshError ?? mutation.error?.message,
  };
}
