/** Schemes accepted by the server-side favicon proxy (mirrors host-safety.ts). */
const PROXY_ALLOWED_SCHEMES = new Set(["http:", "https:"]);
const FAVICON_PROXY_VERSION = "2";

function parseOrigin(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (!PROXY_ALLOWED_SCHEMES.has(parsed.protocol)) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Build the URL to use for a feed favicon in the browser:
 *  - Returns the stored favicon URL directly when one is persisted from ingestion.
 *  - Otherwise builds the `/api/favicon?domain=<origin>` proxy URL, which
 *    uses @vols.rss/worker/favicon server-side to safely resolve the real favicon.
 *
 * Only http/https origins are forwarded to the proxy (matching the server's
 * ALLOWED_SCHEMES guard), so data: / blob: / file: URLs are silently dropped.
 */
export function buildClientFaviconUrl(
  storedFaviconUrl: string | null | undefined,
  siteUrl: string | null,
  feedUrl: string,
): string | null {
  const trimmed = storedFaviconUrl?.trim();
  if (trimmed) return trimmed;

  const origin = parseOrigin(siteUrl) ?? parseOrigin(feedUrl);
  if (!origin) return null;

  return `/api/favicon?domain=${encodeURIComponent(origin)}&v=${FAVICON_PROXY_VERSION}`;
}
