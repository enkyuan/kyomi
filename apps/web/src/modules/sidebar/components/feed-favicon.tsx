"use client";

import { getSvgPath } from "figma-squircle";
import { Rss2Fill } from "@mingcute/react";
import { cn } from "@lib/utils";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { useFavicon } from "@hooks/use-favicon";
import { prewarmFaviconUrl } from "@lib/favicon/cache";

type FeedFaviconShape = "rounded" | "squircle";
type FeedFaviconPriority = "high" | "normal" | "low";

export type FeedFaviconProps = {
  faviconUrl?: string | null;
  feedUrl: string;
  siteUrl: string | null;
  title: string;
  className?: string;
  shape?: FeedFaviconShape;
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
  const [wrapper, setWrapper] = useState<HTMLSpanElement | null>(null);
  const [wrapperSize, setWrapperSize] = useState({ width: 0, height: 0 });
  const isLoaded = faviconUrl !== null && loadedFaviconUrl === faviconUrl;

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

  useEffect(() => {
    if (shape !== "squircle" || !wrapper) {
      return;
    }

    const updateSize = () => {
      setWrapperSize((current) => {
        const next = { width: wrapper.offsetWidth, height: wrapper.offsetHeight };
        return current.width === next.width && current.height === next.height ? current : next;
      });
    };

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(wrapper);

    return () => observer.disconnect();
  }, [shape, wrapper]);

  const mediaClassName = "size-full";
  const squirclePath = useMemo(() => {
    if (shape !== "squircle" || wrapperSize.width <= 0 || wrapperSize.height <= 0) {
      return undefined;
    }

    return getSvgPath({
      width: wrapperSize.width,
      height: wrapperSize.height,
      cornerRadius: squircleCornerRadius,
      cornerSmoothing: squircleCornerSmoothing,
    });
  }, [shape, squircleCornerRadius, squircleCornerSmoothing, wrapperSize.height, wrapperSize.width]);

  const wrapFavicon = (children: ReactNode): ReactElement => {
    const wrapperClassName = cn("relative inline-flex overflow-hidden bg-card/85", className);
    const squircleStyle =
      shape === "squircle"
        ? ({
            borderRadius: squircleCornerRadius,
            clipPath: squirclePath ? `path('${squirclePath}')` : undefined,
            WebkitClipPath: squirclePath ? `path('${squirclePath}')` : undefined,
          } satisfies CSSProperties)
        : undefined;

    return (
      <span
        data-squircle={shape === "squircle" ? squircleCornerRadius : undefined}
        ref={setWrapper}
        className={wrapperClassName}
        style={squircleStyle}
      >
        {children}
      </span>
    );
  };

  if (!faviconUrl) {
    const fallback = <Rss2Fill className={className} aria-label={`${title} feed`} />;

    return shape === "squircle" ? wrapFavicon(fallback) : fallback;
  }

  const loading = priority === "high" ? "eager" : "lazy";
  const fetchPriority = priority === "high" ? "high" : priority === "low" ? "low" : "auto";

  const image = (
    <img
      alt={`${title} favicon`}
      className={cn(
        mediaClassName,
        "absolute inset-0 rounded-[inherit] bg-white object-contain transition-opacity duration-150",
        isLoaded ? "opacity-100" : "opacity-0",
      )}
      decoding="async"
      fetchPriority={fetchPriority}
      key={faviconUrl}
      loading={loading}
      ref={setImageNode}
      referrerPolicy="strict-origin-when-cross-origin"
      src={faviconUrl}
      onLoad={(event) => {
        markFaviconLoaded(event.currentTarget);
      }}
      onError={failCurrentFavicon}
    />
  );

  return wrapFavicon(
    <>
      <Rss2Fill
        aria-hidden="true"
        className="absolute inset-[20%] size-[60%] text-muted-foreground/80"
      />
      {image}
    </>,
  );
}
