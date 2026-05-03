import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshBatchFeeds } from "@modules/feeds/api";
import { useFeedRefresh } from "@modules/feeds/use-refresh";
import { Refresh2Fill } from "@mingcute/react";
import { Button } from "@components/ui/button";
import { cn } from "@lib/utils";

const refreshRelativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const SUMMARY_HOLD_MS = 2200;
const SUMMARY_FADE_MS = 420;

function formatRelativeRefreshTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);
  const absMinutes = Math.abs(diffMinutes);

  if (absMinutes < 60) {
    return refreshRelativeFormatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return refreshRelativeFormatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) {
    return refreshRelativeFormatter.format(diffDays, "day");
  }

  const diffWeeks = Math.round(diffDays / 7);
  if (Math.abs(diffWeeks) < 5) {
    return refreshRelativeFormatter.format(diffWeeks, "week");
  }

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return refreshRelativeFormatter.format(diffMonths, "month");
  }

  const diffYears = Math.round(diffDays / 365);
  return refreshRelativeFormatter.format(diffYears, "year");
}

function getRefreshSummaryLabel({
  refreshStatus,
  lastRefreshStartedAt,
  lastRefreshCompletedAt,
  lastRefreshFailedAt,
}: {
  refreshStatus: string;
  lastRefreshStartedAt?: string | null;
  lastRefreshCompletedAt?: string | null;
  lastRefreshFailedAt?: string | null;
}) {
  if (refreshStatus === "running") {
    const relative = lastRefreshStartedAt
      ? formatRelativeRefreshTimestamp(lastRefreshStartedAt)
      : null;
    return relative ? `Refreshing ${relative}` : "Refreshing now";
  }

  if (refreshStatus === "queued") {
    return "Refresh queued";
  }

  if (refreshStatus === "failed") {
    const relative = lastRefreshFailedAt
      ? formatRelativeRefreshTimestamp(lastRefreshFailedAt)
      : null;
    return relative ? `Refresh failed ${relative}` : "Refresh failed";
  }

  if (lastRefreshCompletedAt) {
    const relative = formatRelativeRefreshTimestamp(lastRefreshCompletedAt);
    if (relative) {
      return `Updated ${relative}`;
    }
  }

  return "Never refreshed";
}

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

export function BatchFeedRefreshStatus({ folderId }: { folderId?: string }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      return refreshBatchFeeds({ data: { folderId } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feeds", "followed"] });
      queryClient.invalidateQueries({ queryKey: ["feeds", "followed", "unread-counts"] });
    },
  });

  return (
    <Button
      aria-label="Refresh feeds"
      className="text-muted-foreground hover:text-foreground"
      disabled={mutation.isPending}
      size="icon"
      title="Refresh feeds"
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

export function FeedRefreshSummary({ feedId }: { feedId: string }) {
  const { refreshStatus, lastRefreshStartedAt, lastRefreshCompletedAt, lastRefreshFailedAt } =
    useFeedRefresh(feedId);
  const [isVisible, setIsVisible] = useState(true);
  const [shouldRender, setShouldRender] = useState(true);

  const summaryLabel = getRefreshSummaryLabel({
    refreshStatus,
    lastRefreshStartedAt,
    lastRefreshCompletedAt,
    lastRefreshFailedAt,
  });

  const shouldPersist = refreshStatus === "running" || refreshStatus === "queued";

  useEffect(() => {
    setShouldRender(true);
    setIsVisible(true);

    if (shouldPersist) {
      return;
    }

    const fadeTimer = window.setTimeout(() => {
      setIsVisible(false);
    }, SUMMARY_HOLD_MS);

    const hideTimer = window.setTimeout(() => {
      setShouldRender(false);
    }, SUMMARY_HOLD_MS + SUMMARY_FADE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [shouldPersist, summaryLabel]);

  if (!shouldRender) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center text-muted-foreground transition-[opacity,filter,transform] ease-out motion-reduce:transition-none",
        isVisible ? "translate-y-0 opacity-100 blur-0" : "-translate-y-px opacity-0 blur-[2px]",
      )}
      style={{ transitionDuration: `${SUMMARY_FADE_MS}ms` }}
    >
      <span className="px-1.5" aria-hidden>
        ·
      </span>
      <span>{summaryLabel}</span>
    </span>
  );
}
