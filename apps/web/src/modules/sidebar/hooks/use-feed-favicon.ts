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
  const [faviconIndex, setFaviconIndex] = useState(() => firstUsableFaviconIndex(faviconUrls));
  const faviconUrl = faviconIndex >= 0 ? faviconUrls[faviconIndex] : null;

  useEffect(() => {
    setFaviconIndex(firstUsableFaviconIndex(faviconUrls));
  }, [faviconUrls.join("\n")]);

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
