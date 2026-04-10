"use client";

import { useEffect, useMemo, useState } from "react";
import { RssFill } from "@mingcute/react";

type FeedFaviconProps = {
  feedUrl: string;
  siteUrl: string | null;
  title: string;
  className?: string;
};

export function FeedFavicon({ feedUrl, siteUrl, title, className }: FeedFaviconProps) {
  const [imageError, setImageError] = useState(false);
  const faviconUrl = useMemo(() => buildFaviconUrl(siteUrl, feedUrl), [feedUrl, siteUrl]);

  useEffect(() => {
    setImageError(false);
  }, [faviconUrl]);

  if (!faviconUrl || imageError) {
    return <RssFill className={className} aria-label={`${title} feed`} />;
  }

  return (
    <img
      alt={`${title} favicon`}
      className={className}
      loading="lazy"
      src={faviconUrl}
      onError={() => {
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
