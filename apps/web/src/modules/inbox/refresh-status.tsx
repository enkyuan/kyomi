import { useFeedRefresh } from "@modules/feeds/use-refresh";
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
      className={`inline-flex size-10 items-center justify-center rounded-xl transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.96] motion-reduce:active:scale-100 hover:bg-background disabled:opacity-50 ${statusClass}`}
      aria-label="Refresh feed"
      title={title}
    >
      <Refresh2Fill className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
    </button>
  );
}
