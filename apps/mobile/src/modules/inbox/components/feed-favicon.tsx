import { buildFaviconUrlCandidates } from "@kyomi/worker/favicon/browser";
import { useEffect, useMemo, useState } from "react";
import { Image, useColorScheme, View } from "react-native";
import { RssIcon } from "@/components/icons/rss";
import { resolveMobileApiUrl } from "@/lib/api-client";
import { getMobileSurfaceTheme } from "@/theme/surfaces";

export type FeedFaviconProps = {
  faviconUrl: string | null;
  feedUrl: string;
  siteUrl: string | null;
  title: string;
  size?: number;
};

export function FeedFavicon({ faviconUrl, feedUrl, siteUrl, title, size = 22 }: FeedFaviconProps) {
  const candidateUrls = useMemo(
    () =>
      buildFaviconUrlCandidates(faviconUrl, siteUrl, feedUrl).map((url) =>
        url.startsWith("/api/") ? resolveMobileApiUrl(url) : url,
      ),
    [faviconUrl, feedUrl, siteUrl],
  );
  const candidateKey = candidateUrls.join("\n");
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [loadedFaviconUrl, setLoadedFaviconUrl] = useState<string | null>(null);
  const { mutedForeground } = getMobileSurfaceTheme(useColorScheme());
  const faviconSource = candidateUrls[candidateIndex];
  const hasLoadedFavicon = faviconSource !== undefined && loadedFaviconUrl === faviconSource;

  useEffect(() => {
    setCandidateIndex(0);
    setLoadedFaviconUrl(null);
  }, [candidateKey]);

  return (
    <View
      accessibilityLabel={hasLoadedFavicon ? undefined : `${title} feed`}
      className="items-center justify-center overflow-hidden rounded-sm bg-card/85"
      style={{ width: size, height: size }}
    >
      {!hasLoadedFavicon ? <RssIcon fill={mutedForeground} size={size * 0.6} /> : null}
      {faviconSource ? (
        <Image
          accessibilityElementsHidden
          className="absolute inset-0 size-full"
          importantForAccessibility="no-hide-descendants"
          key={faviconSource}
          onLoad={() => {
            setLoadedFaviconUrl(faviconSource);
          }}
          onError={() => {
            setLoadedFaviconUrl(null);
            setCandidateIndex((current) => Math.min(current + 1, candidateUrls.length));
          }}
          resizeMode="contain"
          source={{ uri: faviconSource }}
        />
      ) : null}
    </View>
  );
}
