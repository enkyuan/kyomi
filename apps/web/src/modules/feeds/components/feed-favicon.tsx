"use client";

import { Rss2Fill } from "@mingcute/react";
import { Favicon, type FaviconShape } from "@kyomi/ui/favicon";
import { cn } from "@kyomi/ui/lib/utils";
import { useCallback, useEffect, useState } from "react";
import { useFavicon } from "@hooks/use-favicon";
import { prewarmFaviconUrl } from "@lib/favicon/cache";

type FeedFaviconPriority = "high" | "normal" | "low";

export type FeedFaviconProps = {
  faviconUrl?: string | null;
  feedUrl: string;
  siteUrl: string | null;
  title: string;
  className?: string;
  shape?: FaviconShape;
  priority?: FeedFaviconPriority;
  squircleCornerRadius?: number;
  squircleCornerSmoothing?: number;
};

export function FeedFavicon({
  faviconUrl: storedFaviconUrl,
  feedUrl,
  siteUrl,
  title,
  className,
  shape = "rounded",
  priority = "normal",
  squircleCornerRadius = 6,
  squircleCornerSmoothing = 1,
}: FeedFaviconProps) {
  const { faviconUrl, failCurrentFavicon, handleLoad } = useFavicon({
    faviconUrl: storedFaviconUrl,
    feedUrl,
    siteUrl,
  });
  const [loadedFaviconUrl, setLoadedFaviconUrl] = useState<string | null>(null);
  const isLoaded = faviconUrl !== null && loadedFaviconUrl === faviconUrl;
  const isLoading = faviconUrl !== null && !isLoaded;

  useEffect(() => {
    prewarmFaviconUrl(faviconUrl, priority);
  }, [faviconUrl, priority]);

  const markFaviconLoaded = useCallback(
    (image: HTMLImageElement) => {
      if (!faviconUrl || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        return;
      }

      handleLoad(image.naturalWidth, image.naturalHeight);
      setLoadedFaviconUrl((current) => (current === faviconUrl ? current : faviconUrl));
    },
    [faviconUrl, handleLoad],
  );

  const setImageNode = useCallback(
    (image: HTMLImageElement | null) => {
      if (!image?.complete) {
        return;
      }

      // Preloaded or cached favicons can finish before React observes onLoad.
      markFaviconLoaded(image);
    },
    [markFaviconLoaded],
  );

  const loading = priority === "high" ? "eager" : "lazy";
  const fetchPriority = priority === "high" ? "high" : priority === "low" ? "low" : "auto";

  return (
    <Favicon
      alt={`${title} favicon`}
      className={cn("bg-card/85", className)}
      cornerRadius={squircleCornerRadius}
      cornerSmoothing={squircleCornerSmoothing}
      fallback={
        isLoading ? (
          <span className="size-full rounded-[inherit]" />
        ) : (
          <Rss2Fill className="size-full" />
        )
      }
      fallbackClassName={cn(
        isLoading &&
          "inset-0 size-full rounded-[inherit] bg-muted/72 text-transparent shadow-[inset_0_1px_--theme(--color-white/28%),inset_0_0_0_1px_--theme(--color-black/6%)] dark:bg-muted/56 dark:shadow-[inset_0_1px_--theme(--color-white/8%),inset_0_0_0_1px_--theme(--color-white/6%)]",
      )}
      imageClassName={cn("transition-opacity duration-150", isLoaded ? "opacity-100" : "opacity-0")}
      imageKey={faviconUrl ?? undefined}
      imageProps={{
        decoding: "async",
        fetchPriority,
        loading,
        referrerPolicy: "strict-origin-when-cross-origin",
        onLoad: (event) => {
          markFaviconLoaded(event.currentTarget);
        },
        onError: failCurrentFavicon,
      }}
      imageRef={setImageNode}
      shape={shape}
      src={faviconUrl}
      title={title}
    />
  );
}
