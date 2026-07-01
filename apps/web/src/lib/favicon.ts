import { buildClientFaviconUrl } from "@kyomi/worker/favicon/browser";

const CLIENT_FAVICON_ALLOWED_SCHEMES = new Set(["http:", "https:"]);

export function parseClientFaviconOrigin(raw: string | null | undefined): string | null {
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

export function buildFaviconUrlCandidates(
  storedFaviconUrl: string | null | undefined,
  siteUrl: string | null,
  feedUrl: string,
): string[] {
  const proxyFallbackUrl = buildClientFaviconUrl(null, siteUrl, feedUrl);
  const storedUrl = buildClientFaviconUrl(storedFaviconUrl, siteUrl, feedUrl);
  const origin = parseClientFaviconOrigin(siteUrl) ?? parseClientFaviconOrigin(feedUrl);
  const directOriginFallbackUrl = origin ? `${origin}/favicon.ico` : null;

  return [
    ...new Set(
      [proxyFallbackUrl, storedUrl, directOriginFallbackUrl].filter((url): url is string =>
        Boolean(url),
      ),
    ),
  ];
}

export function firstUsableFaviconIndex(urls: string[], rejectedUrls: ReadonlySet<string>): number {
  const index = urls.findIndex((url) => !rejectedUrls.has(url));
  return index >= 0 ? index : -1;
}

export function nextUsableFaviconIndex(
  urls: string[],
  currentUrl: string,
  rejectedUrls: ReadonlySet<string>,
): number {
  const currentIndex = urls.indexOf(currentUrl);
  const searchStart = currentIndex >= 0 ? currentIndex + 1 : 0;
  const nextIndex = urls
    .slice(searchStart)
    .findIndex((candidateUrl) => !rejectedUrls.has(candidateUrl));
  return nextIndex >= 0 ? searchStart + nextIndex : -1;
}
