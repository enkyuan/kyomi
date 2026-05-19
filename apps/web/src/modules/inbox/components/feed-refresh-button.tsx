"use client";

import { useFeedRefresh } from "@modules/feeds/hooks/use-feed-refresh";
import { Refresh2Fill } from "@mingcute/react";
import { Button } from "@components/ui/button";

export function FeedRefreshStatus({ feedId }: { feedId: string }) {
  const { refresh, isRefreshing, refreshStatus, error, lastRefreshCompletedAt } =
    useFeedRefresh(feedId);

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
