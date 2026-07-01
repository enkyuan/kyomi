"use client";

import { useState } from "react";
import {
  buildFaviconUrlCandidates,
  clearFaviconFailed,
  firstUsableFaviconIndex,
  markFaviconFailed,
  nextUsableFaviconIndex,
} from "../lib/favicon";

const MIN_CLIENT_FAVICON_NATURAL_SIZE = 64;

export function useFeedFavicon({
  faviconUrl: storedFaviconUrl,
  feedUrl,
  minNaturalSize = MIN_CLIENT_FAVICON_NATURAL_SIZE,
  siteUrl,
}: {
  faviconUrl?: string | null;
  feedUrl: string;
  minNaturalSize?: number;
  siteUrl: string | null;
}) {
  const faviconUrls = buildFaviconUrlCandidates(storedFaviconUrl, siteUrl, feedUrl);
  const faviconUrlsKey = faviconUrls.join("\n");
  const [prevKey, setPrevKey] = useState(faviconUrlsKey);
  const [faviconIndex, setFaviconIndex] = useState(() => firstUsableFaviconIndex(faviconUrls));

  if (faviconUrlsKey !== prevKey) {
    setPrevKey(faviconUrlsKey);
    setFaviconIndex(firstUsableFaviconIndex(faviconUrls));
  }

  const faviconUrl = faviconIndex >= 0 ? faviconUrls[faviconIndex] : null;

  const failCurrentFavicon = () => {
    if (!faviconUrl) {
      return;
    }
    markFaviconFailed(faviconUrl);
    setFaviconIndex(nextUsableFaviconIndex(faviconUrls, faviconUrl));
  };

  const handleLoad = (naturalWidth: number, naturalHeight: number) => {
    if (naturalWidth < minNaturalSize || naturalHeight < minNaturalSize) {
      failCurrentFavicon();
      return;
    }
    if (faviconUrl) {
      clearFaviconFailed(faviconUrl);
    }
  };

  return {
    faviconUrl,
    failCurrentFavicon,
    handleLoad,
  };
}
