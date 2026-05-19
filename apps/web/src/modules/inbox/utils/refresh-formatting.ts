const refreshRelativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export const SUMMARY_HOLD_MS = 2200;
export const SUMMARY_FADE_MS = 420;
export const BATCH_REFRESH_POLL_MS = 2000;
export const BATCH_REFRESH_GRACE_MS = 12_000;
export const ACTIVE_REFRESH_STATUSES = new Set(["queued", "running"]);

export function hasActiveRefreshStatus(items: Array<{ refreshStatus: string }>) {
  return items.some((item) => ACTIVE_REFRESH_STATUSES.has(item.refreshStatus));
}

export function formatRelativeRefreshTimestamp(value: string) {
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

export function getRefreshSummaryLabel({
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
