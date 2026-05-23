import { assertHttpOrHttpsUrl as assertSharedHttpOrHttpsUrl } from "@shared/net/http-url";

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

export function assertHttpOrHttpsUrl(raw: string): URL {
  return assertSharedHttpOrHttpsUrl(raw, "Only http(s) feed URLs are supported");
}
