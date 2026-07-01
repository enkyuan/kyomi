import type { QueryClient } from "@tanstack/react-query";
import { followedFeedsQueryKey, inboxOrganizerQueryKey } from "../../queries/options";

const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
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

  const diffMs = timestamp - Date.now();
  const absMs = Math.abs(diffMs);
  const minuteMs = 60_000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (absMs < hourMs) {
    return relativeFormatter.format(Math.round(diffMs / minuteMs), "minute");
  }
  if (absMs < dayMs) {
    return relativeFormatter.format(Math.round(diffMs / hourMs), "hour");
  }
  if (absMs < 30 * dayMs) {
    return relativeFormatter.format(Math.round(diffMs / dayMs), "day");
  }
  return absoluteFormatter.format(date);
}

export function formatFeedCount(count: number) {
  return count === 1 ? "1 feed" : `${count} feeds`;
}

export function formatViewedCount(count: number) {
  return count === 1 ? "1 post viewed" : `${count} posts viewed`;
}

export function invalidateOrganizerSurface(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: inboxOrganizerQueryKey() }),
    queryClient.invalidateQueries({ queryKey: ["folders"] }),
    queryClient.invalidateQueries({ queryKey: followedFeedsQueryKey() }),
    queryClient.invalidateQueries({ queryKey: ["feeds", "followed", "unread-counts"] }),
    queryClient.invalidateQueries({ queryKey: ["inbox", "items"] }),
    queryClient.invalidateQueries({ queryKey: ["sidebar", "inbox-summary"] }),
  ]);
}
