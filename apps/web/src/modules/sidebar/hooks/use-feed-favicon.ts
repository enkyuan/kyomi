"use client";

import { useEffect, useState } from "react";
import {
  buildFaviconUrlCandidates,
  firstUsableFaviconIndex,
  nextUsableFaviconIndex,
} from "../lib/favicon";
import {
  canUsePersistentFaviconCache,
  getFaviconCacheOrigin,
  peekCachedFaviconMetadata,
  readCachedFaviconMetadata,
  writeCachedFaviconHit,
  writeCachedFaviconMiss,
  type CachedFaviconMetadata,
} from "../lib/favicon-cache";

function isProxyFaviconUrl(url: string) {
  return url.startsWith("/api/favicon?");
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
  const cacheOrigin = getFaviconCacheOrigin(siteUrl, feedUrl);
  const [cacheHint, setCacheHint] = useState<CachedFaviconMetadata | null>(() =>
    peekCachedFaviconMetadata(cacheOrigin),
  );
  const candidateUrls = buildFaviconUrlCandidates(storedFaviconUrl, siteUrl, feedUrl);
  const faviconUrls =
    cacheHint?.origin === cacheOrigin && cacheHint.status === "miss"
      ? candidateUrls.filter((url) => !isProxyFaviconUrl(url))
      : cacheHint?.origin === cacheOrigin && cacheHint.status === "hit" && cacheHint.url
        ? [cacheHint.url, ...candidateUrls.filter((url) => url !== cacheHint.url)]
        : candidateUrls;
  const faviconUrlsKey = faviconUrls.join("\n");
  const [prevKey, setPrevKey] = useState(faviconUrlsKey);
  const [rejectedUrls, setRejectedUrls] = useState<ReadonlySet<string>>(() => new Set());
  const [faviconIndex, setFaviconIndex] = useState(() =>
    firstUsableFaviconIndex(faviconUrls, new Set()),
  );

  if (faviconUrlsKey !== prevKey) {
    setPrevKey(faviconUrlsKey);
    setRejectedUrls(new Set());
    setFaviconIndex(firstUsableFaviconIndex(faviconUrls, new Set()));
  }

  useEffect(() => {
    let canceled = false;
    const memoryHint = peekCachedFaviconMetadata(cacheOrigin);
    setCacheHint(memoryHint);
    if (!canUsePersistentFaviconCache()) {
      return () => {
        canceled = true;
      };
    }
    void readCachedFaviconMetadata(cacheOrigin).then((entry) => {
      if (!canceled) {
        setCacheHint(entry);
      }
    });
    return () => {
      canceled = true;
    };
  }, [cacheOrigin]);

  const faviconUrl = faviconIndex >= 0 ? faviconUrls[faviconIndex] : null;

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
    setFaviconIndex(-1);
    writeCachedFaviconMiss(cacheOrigin);
  };

  const handleLoad = (naturalWidth: number, naturalHeight: number) => {
    if (faviconUrl) {
      writeCachedFaviconHit({
        origin: cacheOrigin,
        url: faviconUrl,
        width: naturalWidth,
        height: naturalHeight,
      });
    }
    return true;
  };

  return {
    faviconUrl,
    failCurrentFavicon,
    handleLoad,
  };
}
