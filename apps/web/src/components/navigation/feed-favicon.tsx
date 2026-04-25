"use client";

import { useEffect, useState } from "react";
import { RssFill } from "@mingcute/react";

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

/** Accepted schemes for the favicon proxy (mirrors @cronos/favicon's ALLOWED_SCHEMES). */
const PROXY_ALLOWED_SCHEMES = new Set(["http:", "https:"]);

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
 * Returns the URL to use for a feed favicon:
 * - Stored favicon URL from feed metadata when available.
 * - Falls back to the /api/favicon proxy, which uses @cronos/favicon server-side.
 */
export function buildFaviconUrl(
  storedFaviconUrl: string | null | undefined,
  siteUrl: string | null,
  feedUrl: string,
): string | null {
  const trimmed = storedFaviconUrl?.trim();
  if (trimmed) return trimmed;
  const origin = parseOrigin(siteUrl) ?? parseOrigin(feedUrl);
  if (!origin) return null;
  return `/api/favicon?domain=${encodeURIComponent(origin)}`;
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
  const faviconUrl = buildFaviconUrl(storedFaviconUrl, siteUrl, feedUrl);
  const [useFallback, setUseFallback] = useState(faviconUrl ? hasFaviconFailed(faviconUrl) : true);

  useEffect(() => {
    setUseFallback(faviconUrl ? hasFaviconFailed(faviconUrl) : true);
  }, [faviconUrl]);

  if (!faviconUrl || useFallback) {
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
          markFaviconFailed(faviconUrl);
          setUseFallback(true);
        }
      }}
      onError={() => {
        markFaviconFailed(faviconUrl);
        setUseFallback(true);
      }}
    />
  );
}
