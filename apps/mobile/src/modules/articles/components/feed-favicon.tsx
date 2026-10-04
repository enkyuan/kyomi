import { Image } from "expo-image";
import { buildFaviconUrlCandidates } from "@kyomi/worker/favicon/browser";
import { useState } from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import { RssIcon } from "@/components/icons/rss";
import { resolveMobileApiUrl } from "@/lib/api";
import { getMobileSurfaceTheme } from "@/theme/surfaces";

export type FeedFaviconProps = {
  faviconUrl: string | null;
  feedUrl: string;
  siteUrl: string | null;
  title: string;
  size?: number;
};

export function FeedFavicon({ faviconUrl, feedUrl, siteUrl, title, size = 22 }: FeedFaviconProps) {
  const candidateUrls = buildFaviconUrlCandidates(faviconUrl, siteUrl, feedUrl).map((url) =>
    url.startsWith("/api/") ? resolveMobileApiUrl(url) : url,
  );

  return (
    <FeedFaviconImage
      candidateUrls={candidateUrls}
      key={candidateUrls.join("\n")}
      size={size}
      title={title}
    />
  );
}

type FeedFaviconImageProps = {
  candidateUrls: string[];
  size: number;
  title: string;
};

function FeedFaviconImage({ candidateUrls, size, title }: FeedFaviconImageProps) {
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [loadedFaviconUrl, setLoadedFaviconUrl] = useState<string | null>(null);
  const { mutedForeground } = getMobileSurfaceTheme(useColorScheme());
  const faviconSource = candidateUrls[candidateIndex];
  const hasLoadedFavicon = faviconSource !== undefined && loadedFaviconUrl === faviconSource;

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
          importantForAccessibility="no-hide-descendants"
          key={faviconSource}
          onLoad={() => {
            setLoadedFaviconUrl(faviconSource);
          }}
          onError={() => {
            setLoadedFaviconUrl(null);
            setCandidateIndex((current) => Math.min(current + 1, candidateUrls.length));
          }}
          contentFit="contain"
          source={{ uri: faviconSource }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  );
}
