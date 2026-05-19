"use client";

import { useEffect, useState } from "react";
import { RssFill } from "@mingcute/react";
import { buildClientFaviconUrl } from "@vols.rss/favicon/browser";

const FAVICON_ERROR_TTL_MS = 60 * 1000;

const failedFaviconUrls = new Map<string, number>();

/** Schemes accepted by favicon URLs and direct-origin fallback candidates. */
const CLIENT_FAVICON_ALLOWED_SCHEMES = new Set(["http:", "https:"]);

function hasFaviconFailed(url: string): boolean {
  const expiresAt = failedFaviconUrls.get(url);
  if (expiresAt === undefined) return false;
  if (Date.now() >= expiresAt) {
    failedFaviconUrls.delete(url);
    return false;
  }
  return true;
}

function markFaviconFailed(url: string): void {
  failedFaviconUrls.set(url, Date.now() + FAVICON_ERROR_TTL_MS);
}

function clearFaviconFailed(url: string): void {
  failedFaviconUrls.delete(url);
}

function parseOrigin(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (!CLIENT_FAVICON_ALLOWED_SCHEMES.has(parsed.protocol)) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Returns the URL to use for a feed favicon:
 * - Stored favicon URL from feed metadata when available.
 * - Falls back to the /api/favicon proxy, which uses @vols.rss/favicon server-side.
 */
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

type FeedFaviconProps = {
  /** Persisted favicon URL from feed metadata (ingestion); preferred over the proxy when set. */
  faviconUrl?: string | null;
  feedUrl: string;
  siteUrl: string | null;
  title: string;
  className?: string;
};

export function FeedFavicon({
  faviconUrl: storedFaviconUrl,
  feedUrl,
  siteUrl,
  title,
  className,
}: FeedFaviconProps) {
  const faviconUrls = buildFaviconUrlCandidates(storedFaviconUrl, siteUrl, feedUrl);
  const [faviconIndex, setFaviconIndex] = useState(() => {
    const firstUsable = faviconUrls.findIndex((url) => !hasFaviconFailed(url));
    return firstUsable >= 0 ? firstUsable : -1;
  });
  const faviconUrl = faviconIndex >= 0 ? faviconUrls[faviconIndex] : null;

  useEffect(() => {
    const firstUsable = faviconUrls.findIndex((url) => !hasFaviconFailed(url));
    setFaviconIndex(firstUsable >= 0 ? firstUsable : -1);
  }, [faviconUrls.join("\n")]);

  const failCurrentFavicon = () => {
    if (!faviconUrl) {
      return;
    }
    markFaviconFailed(faviconUrl);
    const currentIndex = faviconUrls.indexOf(faviconUrl);
    for (let offset = 1; offset <= faviconUrls.length; offset++) {
      const candidateIndex = (currentIndex + offset) % faviconUrls.length;
      const candidateUrl = faviconUrls[candidateIndex];
      if (candidateUrl && !hasFaviconFailed(candidateUrl)) {
        setFaviconIndex(candidateIndex);
        return;
      }
    }
    setFaviconIndex(-1);
  };

  if (!faviconUrl) {
    return <RssFill className={className} aria-label={`${title} feed`} />;
  }

  return (
    <img
      alt={`${title} favicon`}
      className={className}
      decoding="async"
      loading="lazy"
      // Avoid `no-referrer`: some CDNs / publishers block or degrade hotlinked icons
      // without a referrer. Same-origin proxy URLs only send the site origin.
      referrerPolicy="strict-origin-when-cross-origin"
      src={faviconUrl}
      onLoad={(e) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        if (naturalWidth < 2 || naturalHeight < 2) {
          failCurrentFavicon();
          return;
        }
        clearFaviconFailed(faviconUrl);
      }}
      onError={() => {
        failCurrentFavicon();
      }}
    />
  );
}
