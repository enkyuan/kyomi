"use client";

import { RssFill } from "@mingcute/react";
import { useFeedFavicon } from "../hooks/use-feed-favicon";

export type FeedFaviconProps = {
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
  const { faviconUrl, failCurrentFavicon, handleLoad } = useFeedFavicon({
    faviconUrl: storedFaviconUrl,
    feedUrl,
    siteUrl,
  });

  if (!faviconUrl) {
    return <RssFill className={className} aria-label={`${title} feed`} />;
  }

  return (
    <img
      alt={`${title} favicon`}
      className={className}
      decoding="async"
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      src={faviconUrl}
      onLoad={(event) => {
        const { naturalWidth, naturalHeight } = event.currentTarget;
        handleLoad(naturalWidth, naturalHeight);
      }}
      onError={failCurrentFavicon}
    />
  );
}
