/** Schemes accepted by the server-side favicon proxy (mirrors host-safety.ts). */
const PROXY_ALLOWED_SCHEMES = new Set(["http:", "https:"]);
export const FAVICON_PROXY_VERSION = "5";

function parseHttpUrl(raw: string | null | undefined): URL | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (!PROXY_ALLOWED_SCHEMES.has(parsed.protocol)) return null;
    return parsed;
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

function shouldPreferFeedOrigin(siteUrl: URL, feedUrl: URL): boolean {
  const siteHost = siteUrl.hostname.toLowerCase();
  const feedHost = feedUrl.hostname.toLowerCase();
  if (siteHost === feedHost || !siteHost.startsWith(feedHost)) {
    return false;
  }

  const suffix = siteHost.slice(feedHost.length);
  if (!suffix || suffix.startsWith(".")) {
    return false;
  }

  return /(?:rss|feed|atom|xml)/i.test(suffix);
}

export function selectClientFaviconOrigin(
  siteUrl: string | null | undefined,
  feedUrl: string | null | undefined,
): string | null {
  const parsedSiteUrl = parseHttpUrl(siteUrl);
  const parsedFeedUrl = parseHttpUrl(feedUrl);
  if (parsedSiteUrl && parsedFeedUrl && shouldPreferFeedOrigin(parsedSiteUrl, parsedFeedUrl)) {
    return parsedFeedUrl.origin;
  }
  return parsedSiteUrl?.origin ?? parsedFeedUrl?.origin ?? null;
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

  const origin = selectClientFaviconOrigin(siteUrl, feedUrl);
  if (!origin) return null;

  return `/api/favicon?domain=${encodeURIComponent(origin)}&v=${FAVICON_PROXY_VERSION}`;
}

/**
 * Return favicon URLs in load order: the server-side proxy, persisted metadata,
 * then a direct origin fallback. The browser and native clients share this order
 * so a failed proxy does not leave either surface without a usable icon.
 */
export function buildFaviconUrlCandidates(
  storedFaviconUrl: string | null | undefined,
  siteUrl: string | null,
  feedUrl: string,
): string[] {
  const proxyFallbackUrl = buildClientFaviconUrl(null, siteUrl, feedUrl);
  const storedUrl = buildClientFaviconUrl(storedFaviconUrl, siteUrl, feedUrl);
  const origin = selectClientFaviconOrigin(siteUrl, feedUrl);
  const directOriginFallbackUrl = origin ? `${origin}/favicon.ico` : null;

  return [
    ...new Set(
      [proxyFallbackUrl, storedUrl, directOriginFallbackUrl].filter((url): url is string =>
        Boolean(url),
      ),
    ),
  ];
}
