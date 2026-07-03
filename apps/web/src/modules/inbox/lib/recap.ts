import type { QueryClient } from "@tanstack/react-query";
import { followedFeedsQueryKey, inboxRecapQueryKey } from "@modules/inbox/queries/options";

const absoluteFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export function formatRelativeTime(value: string) {
  const date = new Date(value);
  const timestamp = date.getTime();
  if (Number.isNaN(timestamp)) {
    return "Unknown";
  }

  const diffMs = Date.now() - timestamp;
  const absMs = Math.abs(diffMs);
  const secondMs = 1000;
  const minuteMs = 60_000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const suffix = diffMs >= 0 ? "ago" : "from now";

  if (absMs < 45 * secondMs) {
    return "now";
  }
  if (absMs < hourMs) {
    return `${Math.round(absMs / minuteMs)}m ${suffix}`;
  }
  if (absMs < dayMs) {
    return `${Math.round(absMs / hourMs)}h ${suffix}`;
  }
  if (absMs < 30 * dayMs) {
    return `${Math.round(absMs / dayMs)}d ${suffix}`;
  }
  return absoluteFormatter.format(date);
}

export function formatFeedCount(count: number) {
  return count === 1 ? "1 feed" : `${count} feeds`;
}

export function formatViewedCount(count: number) {
  return count === 1 ? "1 viewed" : `${count} viewed`;
}

export function invalidateRecapSurface(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: inboxRecapQueryKey() }),
    queryClient.invalidateQueries({ queryKey: ["folders"] }),
    queryClient.invalidateQueries({ queryKey: followedFeedsQueryKey() }),
    queryClient.invalidateQueries({ queryKey: ["feeds", "followed", "unread-counts"] }),
    queryClient.invalidateQueries({ queryKey: ["inbox", "items"] }),
    queryClient.invalidateQueries({ queryKey: ["sidebar", "inbox-summary"] }),
  ]);
}
