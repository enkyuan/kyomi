"use client";

import { layout, prepare } from "@chenglou/pretext";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { InboxDensityDto, InboxTimestampDisplayDto } from "@lib/api-schemas";
import type { InboxItem } from "@modules/inbox/api";
import { cn } from "@lib/utils";
import { InboxSourceRow } from "@modules/inbox/components/source-row";
import { InboxItemToolbar, useInboxItemToolbarModel } from "@modules/inbox/components/item-toolbar";
import type { InboxFilter } from "@modules/inbox/api";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@components/ui/card";
import { formatInboxTimestamp } from "@modules/inbox/lib/format-timestamp";
import { useRelativeTimestampRefresh } from "@hooks/use-relative-timestamp-refresh";

const PRETEXT_MIN_FILL_RATIO = 0.97;
const PRETEXT_MAX_TRIM = 8;
const PRETEXT_WIDTH_BUFFER = 4;
const PRETEXT_CACHE_LIMIT = 600;
const pretextPrepareCache = new Map<string, ReturnType<typeof prepare>>();
const pretextFitCache = new Map<string, number | undefined>();

function rememberCacheValue<T>(cache: Map<string, T>, key: string, value: T) {
  if (cache.size >= PRETEXT_CACHE_LIMIT) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) {
      cache.delete(firstKey);
    }
  }
  cache.set(key, value);
  return value;
}

function getPreparedText(text: string, font: string) {
  const key = `${font}\n${text}`;
  return (
    pretextPrepareCache.get(key) ??
    rememberCacheValue(pretextPrepareCache, key, prepare(text, font))
  );
}

function getFittedPretextWidth({
  text,
  font,
  lineHeight,
  maxLines,
  maxWidth,
}: {
  text: string;
  font: string;
  lineHeight: number;
  maxLines: number;
  maxWidth: number;
}) {
  const roundedWidth = Math.round(maxWidth);
  const key = `${font}\n${lineHeight}\n${maxLines}\n${roundedWidth}\n${text}`;
  const cached = pretextFitCache.get(key);
  if (cached !== undefined || pretextFitCache.has(key)) {
    return cached;
  }

  const prepared = getPreparedText(text, font);
  let low = Math.max(
    120,
    Math.ceil(Math.max(roundedWidth * PRETEXT_MIN_FILL_RATIO, roundedWidth - PRETEXT_MAX_TRIM)),
  );
  let high = roundedWidth;
  let best = roundedWidth;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const { lineCount } = layout(prepared, mid, lineHeight);
    if (lineCount <= maxLines) {
      best = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return rememberCacheValue(
    pretextFitCache,
    key,
    Math.min(roundedWidth, best + PRETEXT_WIDTH_BUFFER),
  );
}

export const FeedItem = memo(function FeedItem({
  filter,
  item,
  isSelected,
  isFirst,
  showBottomSeparator,
  containerWidth,
  readerFocusMode = false,
  density,
  fontSizePx,
  showFavicons,
  timestampDisplay,
  timestampHourCycle,
  onSelect,
}: {
  filter: InboxFilter;
  item: InboxItem;
  isSelected: boolean;
  isFirst: boolean;
  showBottomSeparator: boolean;
  containerWidth?: number;
  readerFocusMode?: boolean;
  density: InboxDensityDto;
  fontSizePx: number;
  showFavicons: boolean;
  timestampDisplay: InboxTimestampDisplayDto;
  timestampHourCycle: "12h" | "24h";
  onSelect: (item: InboxItem) => void;
}) {
  const toolbar = useInboxItemToolbarModel({ filter, item });

  useRelativeTimestampRefresh(timestampDisplay);
  const isReadDimmed = item.isRead && filter !== "recent";
  const isCompact = density === "compact";
  const titleFontSizePx = isCompact ? Math.max(14, fontSizePx - 1) : fontSizePx;
  const titleLineHeightPx = isCompact ? titleFontSizePx + 5 : titleFontSizePx + 6;
  const titleFont = `600 ${titleFontSizePx}px "Inter Variable"`;
  const summaryFontSizePx = Math.max(12, Math.round(fontSizePx * 0.875));
  const summaryLineHeightPx = Math.round(
    summaryFontSizePx * (readerFocusMode ? (isCompact ? 1.42 : 1.48) : isCompact ? 1.38 : 1.45),
  );
  const summaryMaxLines = readerFocusMode ? (isCompact ? 4 : 5) : isCompact ? 2 : 3;
  const summaryFont = `400 ${summaryFontSizePx}px "Inter Variable"`;
  const metaFontSizePx = Math.max(11, Math.round(fontSizePx * 0.75));
  const sourceLabelFontSizePx = isCompact ? Math.max(11, metaFontSizePx - 1) : metaFontSizePx;
  const selectItem = () => {
    onSelect(item);
  };

  return (
    <Card
      className={cn(
        "group/inbox-item relative w-full cursor-pointer gap-0 overflow-visible rounded-none border-x-0 border-border/70 bg-transparent shadow-none before:hidden transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] will-change-transform active:scale-[0.996] motion-reduce:active:scale-100",
        isFirst ? "border-t-0" : "border-t",
        showBottomSeparator ? "border-b" : "border-b-0",
        isSelected || item.isRead ? "bg-background" : "hover:bg-background/70",
      )}
      render={
        <div
          role="button"
          tabIndex={0}
          onClick={selectItem}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              selectItem();
            }
          }}
        />
      }
    >
      <InboxItemToolbar {...toolbar.toolbarProps} />
      <CardHeader
        className={cn(
          "px-5",
          readerFocusMode
            ? isCompact
              ? "gap-2 py-3"
              : "gap-2.5 py-3.5"
            : isCompact
              ? "gap-1.5 py-2.5"
              : "gap-2 py-3",
        )}
      >
        <InboxSourceRow
          articleUrl={item.link}
          feedFaviconUrl={item.feedFaviconUrl}
          feedTitle={item.feedTitle}
          showFavicon={showFavicons}
          className={cn(isCompact && "gap-2")}
          iconClassName={cn(isReadDimmed && "opacity-65")}
          labelClassName={cn(isReadDimmed && "text-muted-foreground/70")}
          labelStyle={{ fontSize: `${sourceLabelFontSizePx}px` }}
          enablePreview={false}
        />
        <CardTitle
          className={cn(
            "min-w-0 font-semibold tracking-[-0.012em] text-foreground",
            isReadDimmed && "text-foreground/82",
          )}
          style={{
            fontSize: `${titleFontSizePx}px`,
            lineHeight: `${titleLineHeightPx}px`,
          }}
        >
          <PretextText
            className={cn(
              "font-semibold tracking-[-0.012em] text-foreground",
              "line-clamp-2",
              isReadDimmed && "text-foreground/82",
            )}
            lineHeight={titleLineHeightPx}
            maxLines={2}
            text={item.title}
            font={titleFont}
            containerWidth={containerWidth}
            style={{
              fontSize: `${titleFontSizePx}px`,
              lineHeight: `${titleLineHeightPx}px`,
            }}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 px-5 pb-0 pt-0">
        <PretextText
          className={cn(
            "overflow-hidden text-pretty text-muted-foreground/95",
            isReadDimmed && "text-muted-foreground/65",
          )}
          text={item.summary || "No summary available."}
          font={summaryFont}
          lineHeight={summaryLineHeightPx}
          maxLines={summaryMaxLines}
          containerWidth={containerWidth}
          style={{
            display: "-webkit-box",
            fontSize: `${summaryFontSizePx}px`,
            lineHeight: `${summaryLineHeightPx}px`,
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: summaryMaxLines,
          }}
        />
      </CardContent>
      <CardFooter
        className={cn(
          "flex w-full min-w-0 flex-wrap items-center gap-2 px-5 pt-0",
          readerFocusMode
            ? isCompact
              ? "mt-2 pb-3"
              : "mt-2.5 pb-3.5"
            : isCompact
              ? "mt-1.5 pb-2.5"
              : "mt-2 pb-3",
        )}
      >
        <span
          className={cn(
            "line-clamp-1 max-w-full min-w-0 overflow-hidden text-ellipsis font-medium tracking-[0.01em] text-muted-foreground/85 tabular-nums",
            isReadDimmed && "text-muted-foreground/65",
          )}
          style={{ fontSize: `${metaFontSizePx}px` }}
        >
          {formatInboxTimestamp(item.publishedAt, timestampDisplay, timestampHourCycle)}
        </span>
        {item.isSaved ? (
          <span
            className={cn(
              "line-clamp-1 max-w-full min-w-0 overflow-hidden text-ellipsis font-medium tracking-[0.01em] text-muted-foreground/85",
              isReadDimmed && "text-muted-foreground/65",
            )}
            style={{ fontSize: `${metaFontSizePx}px` }}
          >
            Saved
          </span>
        ) : null}
      </CardFooter>
    </Card>
  );
}, areFeedItemPropsEqual);

const PretextText = memo(function PretextText({
  text,
  font,
  lineHeight,
  maxLines,
  className,
  containerWidth,
  style,
}: {
  text: string;
  font: string;
  lineHeight: number;
  maxLines: number;
  className?: string;
  containerWidth?: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const [parentWidth, setParentWidth] = useState<number | null>(null);

  useEffect(() => {
    // Skip per-item observer when width is provided by the parent container.
    if (containerWidth !== undefined) {
      return;
    }

    const element = ref.current;
    const parent = element?.parentElement;
    if (!element || !parent) {
      return;
    }

    const updateWidth = () => {
      setParentWidth(parent.clientWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(parent);
    return () => observer.disconnect();
  }, [containerWidth]);

  const maxWidth = containerWidth ?? parentWidth;

  const fittedWidth = useMemo(() => {
    if (!maxWidth || maxWidth <= 0) {
      return undefined;
    }
    return getFittedPretextWidth({ text, font, lineHeight, maxLines, maxWidth });
  }, [font, lineHeight, maxLines, maxWidth, text]);

  return (
    <p
      ref={ref}
      className={cn("w-full", className)}
      style={{
        maxWidth: fittedWidth ? `${fittedWidth}px` : undefined,
        ...style,
      }}
    >
      {text}
    </p>
  );
}, arePretextTextPropsEqual);

type FeedItemProps = {
  filter: InboxFilter;
  item: InboxItem;
  isSelected: boolean;
  isFirst: boolean;
  showBottomSeparator: boolean;
  containerWidth?: number;
  readerFocusMode?: boolean;
  density: InboxDensityDto;
  fontSizePx: number;
  showFavicons: boolean;
  timestampDisplay: InboxTimestampDisplayDto;
  timestampHourCycle: "12h" | "24h";
  onSelect: (item: InboxItem) => void;
};

function areFeedItemsEqual(a: InboxItem, b: InboxItem) {
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.summary === b.summary &&
    a.link === b.link &&
    a.publishedAt === b.publishedAt &&
    a.feedFaviconUrl === b.feedFaviconUrl &&
    a.feedTitle === b.feedTitle &&
    a.articleType === b.articleType &&
    a.isRead === b.isRead &&
    a.isSaved === b.isSaved
  );
}

function areFeedItemPropsEqual(prev: FeedItemProps, next: FeedItemProps) {
  return (
    prev.filter === next.filter &&
    areFeedItemsEqual(prev.item, next.item) &&
    prev.isSelected === next.isSelected &&
    prev.isFirst === next.isFirst &&
    prev.showBottomSeparator === next.showBottomSeparator &&
    prev.containerWidth === next.containerWidth &&
    prev.readerFocusMode === next.readerFocusMode &&
    prev.density === next.density &&
    prev.fontSizePx === next.fontSizePx &&
    prev.showFavicons === next.showFavicons &&
    prev.timestampDisplay === next.timestampDisplay &&
    prev.timestampHourCycle === next.timestampHourCycle &&
    prev.onSelect === next.onSelect
  );
}

function arePretextTextPropsEqual(
  prev: {
    text: string;
    font: string;
    lineHeight: number;
    maxLines: number;
    className?: string;
    containerWidth?: number;
    style?: CSSProperties;
  },
  next: {
    text: string;
    font: string;
    lineHeight: number;
    maxLines: number;
    className?: string;
    containerWidth?: number;
    style?: CSSProperties;
  },
) {
  return (
    prev.text === next.text &&
    prev.font === next.font &&
    prev.lineHeight === next.lineHeight &&
    prev.maxLines === next.maxLines &&
    prev.className === next.className &&
    prev.containerWidth === next.containerWidth &&
    prev.style?.fontSize === next.style?.fontSize &&
    prev.style?.lineHeight === next.style?.lineHeight
  );
}
