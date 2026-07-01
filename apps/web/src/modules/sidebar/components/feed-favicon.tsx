"use client";

import { RssFill } from "@mingcute/react";
import { Skeleton } from "@kyomi/ui/skeleton";
import { cn } from "@lib/utils";
import { useEffect, useState } from "react";
import { useFeedFavicon } from "../hooks/use-feed-favicon";

export type FeedFaviconProps = {
  faviconUrl?: string | null;
  feedUrl: string;
  siteUrl: string | null;
  title: string;
  className?: string;
  minNaturalSize?: number;
  showLoadingSkeleton?: boolean;
};

export function FeedFavicon({
  faviconUrl: storedFaviconUrl,
  feedUrl,
  siteUrl,
  title,
  className,
  minNaturalSize,
  showLoadingSkeleton = false,
}: FeedFaviconProps) {
  const { faviconUrl, failCurrentFavicon, handleLoad } = useFeedFavicon({
    faviconUrl: storedFaviconUrl,
    feedUrl,
    siteUrl,
  });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
  }, [faviconUrl]);

  const getMinimumNaturalSize = (image: HTMLImageElement) => {
    if (typeof minNaturalSize === "number") {
      return minNaturalSize;
    }
    const renderedSize = Math.max(image.clientWidth, image.clientHeight);
    if (renderedSize <= 0) {
      return undefined;
    }
    return Math.ceil(renderedSize * (window.devicePixelRatio || 1));
  };

  if (!faviconUrl) {
    return <RssFill className={className} aria-label={`${title} feed`} />;
  }

  const image = (
    <img
      alt={`${title} favicon`}
      className={cn(
        showLoadingSkeleton ? "size-full rounded-[inherit]" : className,
        "bg-white object-contain",
        showLoadingSkeleton && !isLoaded && "opacity-0",
      )}
      decoding="async"
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      src={faviconUrl}
      onLoad={(event) => {
        const image = event.currentTarget;
        setIsLoaded(
          handleLoad(image.naturalWidth, image.naturalHeight, getMinimumNaturalSize(image)),
        );
      }}
      onError={failCurrentFavicon}
    />
  );

  if (!showLoadingSkeleton) {
    return image;
  }

  return (
    <span className={cn("relative inline-flex overflow-hidden", className)}>
      {!isLoaded ? <Skeleton className="absolute inset-0 rounded-[inherit]" /> : null}
      {image}
    </span>
  );
}
