"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listFeedRefreshStatuses, refreshBatchFeeds } from "@modules/feeds/api";
import {
  BATCH_REFRESH_GRACE_MS,
  BATCH_REFRESH_POLL_MS,
  hasActiveRefreshStatus,
} from "@modules/inbox/lib/feed-refresh-formatting";
import {
  feedRefreshStatusQueryKey,
  invalidateFeedAndInboxQueries,
} from "@modules/inbox/lib/query-options";
import { Refresh2Fill } from "@mingcute/react";
import { Button } from "@components/ui/button";

export function BatchFeedRefreshStatus({ folderId }: { folderId?: string }) {
  const queryClient = useQueryClient();
  const [isWatching, setIsWatching] = useState(false);
  const pollStartRef = useRef<number | null>(null);
  const wasRefreshingRef = useRef(false);

  const invalidateRefreshQueries = useCallback(() => {
    invalidateFeedAndInboxQueries(queryClient);
  }, [queryClient]);

  const refreshStatusQuery = useQuery({
    queryKey: feedRefreshStatusQueryKey(folderId),
    queryFn: () => listFeedRefreshStatuses({ data: { folderId } }),
    enabled: isWatching,
    refetchInterval: (query) => {
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

  const hasActiveRefresh = hasActiveRefreshStatus(refreshStatusQuery.data ?? []);

  const mutation = useMutation({
    mutationFn: async () => refreshBatchFeeds({ data: { folderId } }),
    onSuccess: (result) => {
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
        setIsWatching(true);
      }
    },
  });

  useEffect(() => {
    if (!isWatching) {
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
      setIsWatching(false);
      return;
    }

    const startedAt = pollStartRef.current;
    if (startedAt && Date.now() - startedAt >= BATCH_REFRESH_GRACE_MS) {
      setIsWatching(false);
    }
  }, [hasActiveRefresh, invalidateRefreshQueries, isWatching]);

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
