"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listFeedRefreshStatuses,
  refreshBatchFeeds,
  type FeedRefreshStatusRow,
} from "@modules/feeds/api";
import {
  applyBatchRefreshQueued,
  getFollowedFeedsSnapshot,
  restoreFeedCacheSnapshot,
} from "@modules/feeds/queries/cache";
import { useFeedRefresh } from "@modules/feeds/hooks/use-feed-refresh";
import {
  BATCH_REFRESH_GRACE_MS,
  BATCH_REFRESH_POLL_MS,
  hasActiveRefreshStatus,
} from "@modules/inbox/utils/refresh-formatting";
import {
  feedRefreshStatusQueryKey,
  invalidateFeedAndInboxQueries,
} from "@modules/inbox/queries/options";
import { Refresh2Fill } from "@mingcute/react";
import { Button } from "@kyomi/ui/button";

type UpdateProps = { feedId: string; folderId?: never } | { feedId?: never; folderId?: string };

export function Update(props: UpdateProps) {
  if (props.feedId) {
    return <SingleFeedUpdate feedId={props.feedId} />;
  }

  return <BatchFeedUpdate folderId={props.folderId} />;
}

function SingleFeedUpdate({ feedId }: { feedId: string }) {
  const { refresh, isRefreshing, refreshStatus, error, lastRefreshCompletedAt } =
    useFeedRefresh(feedId);

  // Auto-refresh feed every 10 minutes
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!isRefreshing) {
        refresh();
      }
    }, 600000);

    return () => clearInterval(intervalId);
  }, [refresh, isRefreshing]);

  const title =
    refreshStatus === "failed"
      ? `Refresh failed${error ? `: ${error}` : ""}`
      : refreshStatus === "queued"
        ? "Refresh queued"
        : refreshStatus === "running"
          ? "Refreshing feed"
          : lastRefreshCompletedAt
            ? `Last refreshed ${new Date(lastRefreshCompletedAt).toLocaleString()}`
            : "Refresh feed";

  return (
    <Button
      aria-label="Refresh feed"
      className={
        refreshStatus === "failed"
          ? "text-destructive hover:text-destructive"
          : "text-muted-foreground hover:text-foreground"
      }
      disabled={isRefreshing}
      size="icon"
      title={title}
      variant="ghost"
      onClick={(e) => {
        e.preventDefault();
        refresh();
      }}
    >
      <Refresh2Fill className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
    </Button>
  );
}

function BatchFeedUpdate({ folderId }: { folderId?: string }) {
  const queryClient = useQueryClient();
  const isWatchingRef = useRef(false);
  const pollStartRef = useRef<number | null>(null);
  const wasRefreshingRef = useRef(false);

  const invalidateRefreshQueries = useCallback(() => {
    invalidateFeedAndInboxQueries(queryClient);
  }, [queryClient]);

  const { data: refreshStatusData, refetch: refetchRefreshStatus } = useQuery({
    queryKey: feedRefreshStatusQueryKey(folderId),
    queryFn: async () => (await listFeedRefreshStatuses({ data: { folderId } })) ?? [],
    refetchInterval: (query) => {
      if (!isWatchingRef.current) {
        return false;
      }
      const items = query.state?.data ?? [];
      const active = hasActiveRefreshStatus(items);
      if (active) {
        return BATCH_REFRESH_POLL_MS;
      }
      const startedAt = pollStartRef.current;
      if (startedAt && Date.now() - startedAt < BATCH_REFRESH_GRACE_MS) {
        return BATCH_REFRESH_POLL_MS;
      }
      return false;
    },
  });

  const hasActiveRefresh = hasActiveRefreshStatus(refreshStatusData ?? []);

  const mutation = useMutation({
    mutationFn: async () => refreshBatchFeeds({ data: { folderId } }),
    onMutate: async () => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: feedRefreshStatusQueryKey(folderId) }),
        queryClient.cancelQueries({ queryKey: ["feeds", "followed"] }),
      ]);
      const previousStatuses = queryClient.getQueryData<FeedRefreshStatusRow[]>(
        feedRefreshStatusQueryKey(folderId),
      );
      const followedFeedsSnapshot = getFollowedFeedsSnapshot(queryClient);
      pollStartRef.current = Date.now();
      wasRefreshingRef.current = false;
      isWatchingRef.current = true;
      applyBatchRefreshQueued(queryClient, folderId);
      return { followedFeedsSnapshot, previousStatuses };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousStatuses) {
        queryClient.setQueryData(feedRefreshStatusQueryKey(folderId), context.previousStatuses);
      }
      restoreFeedCacheSnapshot(queryClient, context?.followedFeedsSnapshot);
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: feedRefreshStatusQueryKey(folderId) });
      invalidateRefreshQueries();
      if (result.failedCount && result.failedCount > 0) {
        console.warn("feeds.refresh.batch.partial_failure", {
          enqueued: result.count,
          failed: result.failedCount,
          folderId,
        });
      }
      if (result.count > 0) {
        pollStartRef.current = Date.now();
        wasRefreshingRef.current = false;
        isWatchingRef.current = true;
        void refetchRefreshStatus();
      }
    },
  });

  // Auto-refresh all feeds in this scope every 10 minutes
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!mutation.isPending) {
        mutation.mutate();
      }
    }, 600000);

    return () => clearInterval(intervalId);
  }, [mutation]);

  useEffect(() => {
    if (!isWatchingRef.current) {
      pollStartRef.current = null;
      wasRefreshingRef.current = false;
      return;
    }

    if (!pollStartRef.current) {
      pollStartRef.current = Date.now();
    }

    if (hasActiveRefresh) {
      wasRefreshingRef.current = true;
      return;
    }

    if (wasRefreshingRef.current) {
      invalidateRefreshQueries();
      isWatchingRef.current = false;
      return;
    }

    const startedAt = pollStartRef.current;
    if (startedAt && Date.now() - startedAt >= BATCH_REFRESH_GRACE_MS) {
      isWatchingRef.current = false;
    }
  }, [hasActiveRefresh, invalidateRefreshQueries]);

  const batchTitle =
    mutation.isError && mutation.error instanceof Error
      ? `Refresh failed: ${mutation.error.message}`
      : mutation.isError
        ? "Refresh failed"
        : mutation.data?.failedCount
          ? `Some feeds failed to queue (${mutation.data.failedCount}); ${mutation.data.count} queued`
          : "Refresh feeds";

  return (
    <Button
      aria-label="Refresh feeds"
      className={
        mutation.isError
          ? "text-destructive hover:text-destructive"
          : "text-muted-foreground hover:text-foreground"
      }
      disabled={mutation.isPending}
      size="icon"
      title={batchTitle}
      variant="ghost"
      onClick={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <Refresh2Fill className={`size-4 ${mutation.isPending ? "animate-spin" : ""}`} />
    </Button>
  );
}
