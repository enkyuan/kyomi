import { useFeedRefresh } from "@hooks/use-feed-refresh";
import { Refresh3Line } from "@mingcute/react";
import { useEffect, useState } from "react";

export function FeedRefreshStatus({ feedId }: { feedId: string }) {
  const { refresh, isRefreshing, refreshStatus, lastRefreshCompletedAt, error } =
    useFeedRefresh(feedId);
  const [timeAgo, setTimeAgo] = useState<string>("");

  useEffect(() => {
    if (!lastRefreshCompletedAt) {
      setTimeAgo("");
      return;
    }
    const update = () => {
      const now = Date.now();
      const updated = new Date(lastRefreshCompletedAt).getTime();
      const diffMs = now - updated;
      const diffMinutes = Math.floor(diffMs / 60000);
      if (diffMinutes < 1) setTimeAgo("Updated just now");
      else if (diffMinutes < 60) setTimeAgo(`Updated ${diffMinutes}m ago`);
      else {
        const hours = Math.floor(diffMinutes / 60);
        setTimeAgo(`Updated ${hours}h ago`);
      }
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [lastRefreshCompletedAt]);

  const getStatusText = () => {
    if (isRefreshing || refreshStatus === "running" || refreshStatus === "queued")
      return "Checking for updates...";
    if (refreshStatus === "failed" || error) return "Refresh failed";
    if (timeAgo) return timeAgo;
    return "Check for updates";
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{getStatusText()}</span>
      <button
        type="button"
        disabled={isRefreshing}
        onClick={(e) => {
          e.preventDefault();
          refresh();
        }}
        className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 transition-colors"
        aria-label="Refresh feed"
        title="Refresh feed"
      >
        <Refresh3Line className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
