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

type FeedFaviconProps = {
  feedUrl: string;
  siteUrl: string | null;
  title: string;
  className?: string;
};

export function FeedFavicon({ feedUrl, siteUrl, title, className }: FeedFaviconProps) {
  const faviconUrl = buildFaviconUrl(siteUrl, feedUrl);
  const [imageError, setImageError] = useState(
    faviconUrl ? hasFaviconFailed(faviconUrl) : false,
  );

  useEffect(() => {
    setImageError(faviconUrl ? hasFaviconFailed(faviconUrl) : false);
  }, [faviconUrl]);

  if (!faviconUrl || imageError) {
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
      onError={() => {
        markFaviconFailed(faviconUrl);
        setImageError(true);
      }}
    />
  );
}

function buildFaviconUrl(siteUrl: string | null, feedUrl: string) {
  const hostUrl = parseHostUrl(siteUrl) ?? parseHostUrl(feedUrl);
  if (!hostUrl) {
    return null;
  }

  return `/api/favicon?domain=${encodeURIComponent(hostUrl)}`;
}

function parseHostUrl(raw: string | null | undefined) {
  if (!raw) {
    return null;
  }

  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}
