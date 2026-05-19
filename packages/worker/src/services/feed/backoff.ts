import type { RefreshTimingSnapshot } from "./types";

export function computeFailureBackoffMs(snapshot: RefreshTimingSnapshot): number {
  const hasConsecutiveFailure =
    Boolean(snapshot.lastRefreshFailedAt) &&
    (!snapshot.lastRefreshSucceededAt ||
      snapshot.lastRefreshFailedAt!.getTime() >= snapshot.lastRefreshSucceededAt.getTime());
  return hasConsecutiveFailure ? 60 * 60 * 1000 : 15 * 60 * 1000;
}

function faviconSourceRank(source: string | null): number {
  switch (source) {
    case "html_link":
    case "feed_icon":
      return 3;
    case "google_s2":
    case "duckduckgo":
      return 2;
    case "favicon_ico":
      return 1;
    default:
      return 0;
  }
}

export function shouldResolveFavicon({
  currentUrl,
  currentSource,
  linkChanged,
}: {
  currentUrl: string | null;
  currentSource: string | null;
  linkChanged: boolean;
}): boolean {
  return (
    !currentUrl || linkChanged || faviconSourceRank(currentSource) < faviconSourceRank("html_link")
  );
}
