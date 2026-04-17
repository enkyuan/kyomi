"use client";

import { useEffect, useState } from "react";
import { RssFill } from "@mingcute/react";
import { cn } from "@lib/utils";

const FAVICON_FAILURE_TTL_MS = 5 * 60 * 1000;
const failedFaviconUrls = new Map<string, number>();

type FeedFaviconProps = {
  feedUrl: string;
  siteUrl: string | null;
  title: string;
  className?: string;
};

export function FeedFavicon({ feedUrl, siteUrl, title, className }: FeedFaviconProps) {
  const faviconUrl = buildFaviconUrl(siteUrl, feedUrl);
  const [imageError, setImageError] = useState(
    faviconUrl ? isTemporarilyFailedUrl(faviconUrl) : false,
  );
  const resolvedClassName = className ?? "size-4";

  useEffect(() => {
    setImageError(faviconUrl ? isTemporarilyFailedUrl(faviconUrl) : false);
  }, [faviconUrl]);

  if (!faviconUrl || imageError) {
    return (
      <span className={cn("text-orange-300")} role="img" aria-label={`${title} feed`}>
        <RssFill color="currentColor" />
      </span>
    );
  }

  return (
    <img
      alt={`${title} favicon`}
      className={resolvedClassName}
      decoding="async"
      loading="lazy"
      referrerPolicy="no-referrer"
      src={faviconUrl}
      onLoad={(event) => {
        if (!isRenderableFavicon(event.currentTarget)) {
          failedFaviconUrls.set(faviconUrl, Date.now() + FAVICON_FAILURE_TTL_MS);
          setImageError(true);
        }
      }}
      onError={() => {
        failedFaviconUrls.set(faviconUrl, Date.now() + FAVICON_FAILURE_TTL_MS);
        setImageError(true);
      }}
    />
  );
}

function isTemporarilyFailedUrl(faviconUrl: string) {
  const expiresAt = failedFaviconUrls.get(faviconUrl);
  if (!expiresAt) {
    return false;
  }
  if (expiresAt <= Date.now()) {
    failedFaviconUrls.delete(faviconUrl);
    return false;
  }
  return true;
}

function isRenderableFavicon(image: HTMLImageElement): boolean {
  if (image.naturalWidth <= 1 || image.naturalHeight <= 1) {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(16, image.naturalWidth);
    canvas.height = Math.min(16, image.naturalHeight);
    const context = canvas.getContext("2d");
    if (!context) {
      return true;
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 3; index < data.length; index += 4) {
      if ((data[index] ?? 0) > 8) {
        return true;
      }
    }
    return false;
  } catch {
    return true;
  }
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
