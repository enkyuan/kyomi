"use client";

import { layout, prepare } from "@chenglou/pretext";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { InboxItem } from "@modules/inbox/api";
import { cn } from "@lib/utils";
import { InboxSourceRow } from "@modules/inbox/source-row";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@components/ui/card";

const TITLE_FONT = '600 16px "Inter Variable"';
const TITLE_LINE_HEIGHT = 22;
const PRETEXT_MIN_FILL_RATIO = 0.97;
const PRETEXT_MAX_TRIM = 8;
const PRETEXT_WIDTH_BUFFER = 4;
const PRETEXT_CACHE_LIMIT = 600;
const ARTICLE_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});
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
  item,
  isSelected,
  isFirst,
  showBottomSeparator,
  containerWidth,
  onSelect,
}: {
  item: InboxItem;
  isSelected: boolean;
  isFirst: boolean;
  showBottomSeparator: boolean;
  containerWidth?: number;
  onSelect: (itemId: string) => void;
}) {
  const selectItem = () => onSelect(item.id);

  return (
    <Card
      className={cn(
        "w-full cursor-pointer gap-0 overflow-hidden rounded-none border-x-0 border-border/70 bg-transparent shadow-none before:hidden transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] will-change-transform active:scale-[0.996] motion-reduce:active:scale-100",
        isFirst ? "border-t-0" : "border-t",
        showBottomSeparator ? "border-b" : "border-b-0",
        isSelected ? "bg-background" : "hover:bg-background/70",
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
      <CardHeader className="gap-2 px-5 py-3">
        <InboxSourceRow
          articleUrl={item.link}
          feedFaviconUrl={item.feedFaviconUrl}
          feedTitle={item.feedTitle}
        />
        <CardTitle className="min-w-0 text-[16px] font-semibold leading-5.5 tracking-[-0.012em] text-foreground">
          <PretextText
            className="line-clamp-2 text-[16px] font-semibold leading-5.5 tracking-[-0.012em] text-foreground"
            lineHeight={TITLE_LINE_HEIGHT}
            maxLines={2}
            text={item.title}
            font={TITLE_FONT}
            containerWidth={containerWidth}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-0 pt-0">
        <p className="line-clamp-3 overflow-hidden text-pretty text-[14px] leading-[1.45] text-muted-foreground/95">
          {item.summary || "No summary available."}
        </p>
      </CardContent>
      <CardFooter className="mt-2 flex w-full flex-wrap items-center gap-2 px-5 pb-3 pt-0">
        <span className="line-clamp-1 text-[12px] font-medium tracking-[0.01em] text-muted-foreground/85 tabular-nums">
          {formatArticleTimestamp(item.publishedAt)}
        </span>
        {item.isSaved ? (
          <span className="line-clamp-1 text-[12px] font-medium tracking-[0.01em] text-muted-foreground/85">
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
}: {
  text: string;
  font: string;
  lineHeight: number;
  maxLines: number;
  className?: string;
  containerWidth?: number;
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
      }}
    >
      {text}
    </p>
  );
}, arePretextTextPropsEqual);

type FeedItemProps = {
  item: InboxItem;
  isSelected: boolean;
  isFirst: boolean;
  showBottomSeparator: boolean;
  containerWidth?: number;
  onSelect: (itemId: string) => void;
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
    areFeedItemsEqual(prev.item, next.item) &&
    prev.isSelected === next.isSelected &&
    prev.isFirst === next.isFirst &&
    prev.showBottomSeparator === next.showBottomSeparator &&
    prev.containerWidth === next.containerWidth &&
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
  },
  next: {
    text: string;
    font: string;
    lineHeight: number;
    maxLines: number;
    className?: string;
    containerWidth?: number;
  },
) {
  return (
    prev.text === next.text &&
    prev.font === next.font &&
    prev.lineHeight === next.lineHeight &&
    prev.maxLines === next.maxLines &&
    prev.className === next.className &&
    prev.containerWidth === next.containerWidth
  );
}

function formatArticleTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return ARTICLE_TIMESTAMP_FORMATTER.format(date);
}
