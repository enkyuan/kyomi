"use client";

import { useEffect, useState } from "react";
import {
  buildFaviconUrlCandidates,
  clearFaviconFailed,
  firstUsableFaviconIndex,
  markFaviconFailed,
  nextUsableFaviconIndex,
} from "../lib/favicon";

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
    if (naturalWidth < 2 || naturalHeight < 2) {
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
