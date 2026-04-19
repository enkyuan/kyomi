import { useFeedRefresh } from "@hooks/use-feed-refresh";
import { Refresh2Fill } from "@mingcute/react";

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

  const statusClass =
    refreshStatus === "failed" ? "text-destructive" : "text-muted-foreground hover:text-foreground";

  return (
    <button
      type="button"
      disabled={isRefreshing}
      onClick={(e) => {
        e.preventDefault();
        refresh();
      }}
      className={`inline-flex size-8 items-center justify-center rounded-xl transition-colors hover:bg-background disabled:opacity-50 ${statusClass}`}
      aria-label="Refresh feed"
      title={title}
    >
      <Refresh2Fill className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
    </button>
  );
}
