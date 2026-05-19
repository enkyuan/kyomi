import { buildClientFaviconUrl } from "@vols.rss/worker/favicon/browser";

const FAVICON_ERROR_TTL_MS = 60 * 1000;
const CLIENT_FAVICON_ALLOWED_SCHEMES = new Set(["http:", "https:"]);

const failedFaviconUrls = new Map<string, number>();

function parseOrigin(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = new URL(raw);
    if (!CLIENT_FAVICON_ALLOWED_SCHEMES.has(parsed.protocol)) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function hasFaviconFailed(url: string): boolean {
  const expiresAt = failedFaviconUrls.get(url);
  if (expiresAt === undefined) {
    return false;
  }
  if (Date.now() >= expiresAt) {
    failedFaviconUrls.delete(url);
    return false;
  }
  return true;
}

export function markFaviconFailed(url: string): void {
  failedFaviconUrls.set(url, Date.now() + FAVICON_ERROR_TTL_MS);
}

export function clearFaviconFailed(url: string): void {
  failedFaviconUrls.delete(url);
}

export function buildFaviconUrl(
  storedFaviconUrl: string | null | undefined,
  siteUrl: string | null,
  feedUrl: string,
): string | null {
  return buildClientFaviconUrl(storedFaviconUrl, siteUrl, feedUrl);
}

export function buildFaviconUrlCandidates(
  storedFaviconUrl: string | null | undefined,
  siteUrl: string | null,
  feedUrl: string,
): string[] {
  const proxyFallbackUrl = buildClientFaviconUrl(null, siteUrl, feedUrl);
  const preferredUrl = buildClientFaviconUrl(storedFaviconUrl, siteUrl, feedUrl);
  const origin = parseOrigin(siteUrl) ?? parseOrigin(feedUrl);
  const directOriginFallbackUrl = origin ? `${origin}/favicon.ico` : null;

  return [
    ...new Set(
      [preferredUrl, proxyFallbackUrl, directOriginFallbackUrl].filter((url): url is string =>
        Boolean(url),
      ),
    ),
  ];
}

export function firstUsableFaviconIndex(urls: string[]): number {
  const index = urls.findIndex((url) => !hasFaviconFailed(url));
  return index >= 0 ? index : -1;
}

export function nextUsableFaviconIndex(urls: string[], currentUrl: string): number {
  const currentIndex = urls.indexOf(currentUrl);
  for (let offset = 1; offset <= urls.length; offset++) {
    const candidateIndex = (currentIndex + offset) % urls.length;
    const candidateUrl = urls[candidateIndex];
    if (candidateUrl && !hasFaviconFailed(candidateUrl)) {
      return candidateIndex;
    }
  }
  return -1;
}
