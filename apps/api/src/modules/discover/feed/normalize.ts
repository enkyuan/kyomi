import { assertHttpOrHttpsUrl as assertSharedHttpOrHttpsUrl } from "@shared/net/http";

/**
 * Canonical feed URL for deduplication (lowercase host, strip hash, trim trailing slash on path).
 */
export function normalizeFeedUrl(raw: string): string {
  const trimmed = raw.trim();
  const u = new URL(trimmed);
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.slice(0, -1);
  }
  return u.href;
}

/**
 * A feed URL is stored once and shared by everyone who follows it, and discovery search matches on
 * it, so it must not carry a login: `https://user:password@host/feed` would hand the password to
 * every other account.
 */
export function assertHttpOrHttpsUrl(raw: string): URL {
  const url = assertSharedHttpOrHttpsUrl(raw, "Only http(s) feed URLs are supported");
  if (url.username || url.password) {
    throw new Error("Feed URLs with a username or password are not supported");
  }
  return url;
}
