"use client";

import { useEffect, useState } from "react";
import { RssFill } from "@mingcute/react";
import { buildClientFaviconUrl } from "@cronos/favicon/browser";

const FAVICON_ERROR_TTL_MS = 5 * 60 * 1000;

const failedFaviconUrls = new Map<string, number>();

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

/**
 * Returns the URL to use for a feed favicon:
 * - Stored favicon URL from feed metadata when available.
 * - Falls back to the /api/favicon proxy, which uses @cronos/favicon server-side.
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
  const preferredUrl = buildClientFaviconUrl(storedFaviconUrl, siteUrl, feedUrl);
  const proxyFallbackUrl = buildClientFaviconUrl(null, siteUrl, feedUrl);

  return [
    ...new Set([preferredUrl, proxyFallbackUrl].filter((url): url is string => Boolean(url))),
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
  const [faviconIndex, setFaviconIndex] = useState(() =>
    faviconUrls.findIndex((url) => !hasFaviconFailed(url)),
  );
  const faviconUrl = faviconIndex >= 0 ? faviconUrls[faviconIndex] : null;

  useEffect(() => {
    setFaviconIndex(faviconUrls.findIndex((url) => !hasFaviconFailed(url)));
  }, [faviconUrls.join("\n")]);

  const failCurrentFavicon = () => {
    if (!faviconUrl) {
      return;
    }
    markFaviconFailed(faviconUrl);
    setFaviconIndex(faviconUrls.findIndex((url) => url !== faviconUrl && !hasFaviconFailed(url)));
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
      referrerPolicy="no-referrer"
      src={faviconUrl}
      onLoad={(e) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        if (naturalWidth < 2 || naturalHeight < 2) {
          failCurrentFavicon();
        }
      }}
      onError={() => {
        failCurrentFavicon();
      }}
    />
  );
}
