/** Schemes accepted by the server-side favicon proxy (mirrors host-safety.ts). */
const PROXY_ALLOWED_SCHEMES = new Set(["http:", "https:"]);
const FAVICON_PROXY_VERSION = "4";

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

function buildHighResolutionGoogleFaviconUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    if (parsed.hostname !== "www.google.com" || parsed.pathname !== "/s2/favicons") {
      return null;
    }
    parsed.searchParams.set("sz", "256");
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Build a favicon URL for the browser:
 *  - Returns the stored favicon URL when one is passed in.
 *  - Otherwise builds the `/api/favicon?domain=<origin>` proxy URL, which
 *    uses @kyomi/worker/favicon server-side to safely resolve a high-quality
 *    site icon.
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
  if (trimmed) return buildHighResolutionGoogleFaviconUrl(trimmed) ?? trimmed;

  const origin = parseOrigin(siteUrl) ?? parseOrigin(feedUrl);
  if (!origin) return null;

  return `/api/favicon?domain=${encodeURIComponent(origin)}&v=${FAVICON_PROXY_VERSION}`;
}
