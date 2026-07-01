"use client";

import { getSvgPath } from "figma-squircle";
import { RssFill } from "@mingcute/react";
import { cn } from "@lib/utils";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { useFeedFavicon } from "../hooks/use-feed-favicon";
import { prewarmFaviconUrl } from "../lib/favicon-cache";

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
  const { faviconUrl, failCurrentFavicon, handleLoad } = useFeedFavicon({
    faviconUrl: storedFaviconUrl,
    feedUrl,
    siteUrl,
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const [wrapperSize, setWrapperSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    setIsLoaded(false);
    prewarmFaviconUrl(faviconUrl, priority);

    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
      setIsLoaded(handleLoad(image.naturalWidth, image.naturalHeight));
    }
  }, [faviconUrl, priority]);

  useEffect(() => {
    if (shape !== "squircle") {
      return;
    }

    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }

    const updateSize = () => {
      setWrapperSize((current) => {
        const next = { width: wrapper.offsetWidth, height: wrapper.offsetHeight };
        return current.width === next.width && current.height === next.height ? current : next;
      });
    };

    updateSize();
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(wrapper);

    return () => observer.disconnect();
  }, [shape]);

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
        ref={wrapperRef}
        className={wrapperClassName}
        style={squircleStyle}
      >
        {children}
      </span>
    );
  };

  if (!faviconUrl) {
    const fallback = <RssFill className={className} aria-label={`${title} feed`} />;

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
      loading={loading}
      ref={imageRef}
      referrerPolicy="strict-origin-when-cross-origin"
      src={faviconUrl}
      onLoad={(event) => {
        const image = event.currentTarget;
        setIsLoaded(handleLoad(image.naturalWidth, image.naturalHeight));
      }}
      onError={failCurrentFavicon}
    />
  );

  return wrapFavicon(
    <>
      <RssFill
        aria-hidden="true"
        className="absolute inset-[20%] size-[60%] text-muted-foreground/80"
      />
      {image}
    </>,
  );
}
