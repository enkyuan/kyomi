"use client";

import { useState } from "react";
import {
  buildFaviconUrlCandidates,
  firstUsableFaviconIndex,
  nextUsableFaviconIndex,
} from "../lib/favicon";

const MIN_CLIENT_FAVICON_NATURAL_SIZE = 64;

function isScalableFaviconUrl(url: string): boolean {
  if (url.startsWith("data:image/svg+xml")) {
    return true;
  }
  try {
    return new URL(url, window.location.origin).pathname.toLowerCase().endsWith(".svg");
  } catch {
    return url.toLowerCase().endsWith(".svg");
  }
}

export function useFeedFavicon({
  faviconUrl: storedFaviconUrl,
  feedUrl,
  siteUrl,
}: {
  faviconUrl?: string | null;
  feedUrl: string;
  siteUrl: string | null;
}) {
  const faviconUrls = buildFaviconUrlCandidates(storedFaviconUrl, siteUrl, feedUrl);
  const faviconUrlsKey = faviconUrls.join("\n");
  const [prevKey, setPrevKey] = useState(faviconUrlsKey);
  const [rejectedUrls, setRejectedUrls] = useState<ReadonlySet<string>>(() => new Set());
  const [lowResolutionFallbackUrl, setLowResolutionFallbackUrl] = useState<string | null>(null);
  const [acceptedLowResolutionUrl, setAcceptedLowResolutionUrl] = useState<string | null>(null);
  const [faviconIndex, setFaviconIndex] = useState(() =>
    firstUsableFaviconIndex(faviconUrls, new Set()),
  );

  if (faviconUrlsKey !== prevKey) {
    setPrevKey(faviconUrlsKey);
    setRejectedUrls(new Set());
    setLowResolutionFallbackUrl(null);
    setAcceptedLowResolutionUrl(null);
    setFaviconIndex(firstUsableFaviconIndex(faviconUrls, new Set()));
  }

  const faviconUrl =
    acceptedLowResolutionUrl ?? (faviconIndex >= 0 ? faviconUrls[faviconIndex] : null);

  const failCurrentFavicon = () => {
    if (!faviconUrl) {
      return;
    }
    const nextRejectedUrls = new Set(rejectedUrls).add(faviconUrl);
    const nextIndex = nextUsableFaviconIndex(faviconUrls, faviconUrl, nextRejectedUrls);
    setRejectedUrls(nextRejectedUrls);
    if (nextIndex >= 0) {
      setFaviconIndex(nextIndex);
      return;
    }
    if (lowResolutionFallbackUrl) {
      setAcceptedLowResolutionUrl(lowResolutionFallbackUrl);
      return;
    }
    setFaviconIndex(-1);
  };

  const handleLoad = (
    naturalWidth: number,
    naturalHeight: number,
    minNaturalSize = MIN_CLIENT_FAVICON_NATURAL_SIZE,
  ) => {
    if (faviconUrl && isScalableFaviconUrl(faviconUrl)) {
      return true;
    }
    if (
      faviconUrl &&
      acceptedLowResolutionUrl !== faviconUrl &&
      (naturalWidth < minNaturalSize || naturalHeight < minNaturalSize)
    ) {
      setLowResolutionFallbackUrl((current) => current ?? faviconUrl);
      const nextRejectedUrls = new Set(rejectedUrls).add(faviconUrl);
      const nextIndex = nextUsableFaviconIndex(faviconUrls, faviconUrl, nextRejectedUrls);
      if (nextIndex >= 0) {
        setRejectedUrls(nextRejectedUrls);
        setFaviconIndex(nextIndex);
        return false;
      }
      setAcceptedLowResolutionUrl(lowResolutionFallbackUrl ?? faviconUrl);
      return true;
    }
    return true;
  };

  return {
    faviconUrl,
    failCurrentFavicon,
    handleLoad,
  };
}
