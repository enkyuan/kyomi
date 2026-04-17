"use client";

import { useEffect, useState } from "react";
import { RssFill } from "@mingcute/react";

const failedFaviconUrls = new Set<string>();

type FeedFaviconProps = {
  feedUrl: string;
  siteUrl: string | null;
  title: string;
  className?: string;
};

export function FeedFavicon({ feedUrl, siteUrl, title, className }: FeedFaviconProps) {
  const faviconUrl = buildFaviconUrl(siteUrl, feedUrl);
  const [imageError, setImageError] = useState(
    faviconUrl ? failedFaviconUrls.has(faviconUrl) : false,
  );

  useEffect(() => {
    setImageError(faviconUrl ? failedFaviconUrls.has(faviconUrl) : false);
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
        failedFaviconUrls.add(faviconUrl);
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
