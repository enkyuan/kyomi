import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { refreshFeed, getFeedDetail } from "@lib/feed-functions";

export function useFeedRefresh(feedId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      return refreshFeed({ data: { feedId } });
    },
    onSuccess: () => {
      // Invalidate relevant queries immediately
      queryClient.invalidateQueries({ queryKey: ["feeds", "followed"] });
      queryClient.invalidateQueries({ queryKey: ["feeds", "followed", "unread-counts"] });
      queryClient.invalidateQueries({ queryKey: ["inbox", "items"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar", "inbox-summary"] });
      queryClient.invalidateQueries({ queryKey: ["feed-detail", feedId] });
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
      return 10 * 60 * 1000; // background sync every 10 minutes
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
    lastRefreshCompletedAt: detailQuery.data?.lastRefreshCompletedAt,
    lastRefreshFailedAt: detailQuery.data?.lastRefreshFailedAt,
    error: detailQuery.data?.lastRefreshError ?? mutation.error?.message,
  };
}
