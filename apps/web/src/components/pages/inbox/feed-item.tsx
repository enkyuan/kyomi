"use client";

import { layout, prepare } from "@chenglou/pretext";
import { useEffect, useMemo, useRef, useState } from "react";
import type { InboxItem } from "@lib/inbox-functions";
import { cn } from "@lib/utils";
import { InboxSourceRow } from "@components/pages/inbox/inbox-source-row";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@components/ui/card";

const TITLE_FONT = '600 16px "Inter Variable"';
const TITLE_LINE_HEIGHT = 22;
const FOOTER_FONT = '500 13px "Inter Variable"';
const FOOTER_LINE_HEIGHT = 18;
const PRETEXT_MIN_FILL_RATIO = 0.97;
const PRETEXT_MAX_TRIM = 8;
const PRETEXT_WIDTH_BUFFER = 4;

export function FeedItem({
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
  onSelect: () => void;
}) {
  return (
    <Card
      className={cn(
        "w-full cursor-pointer gap-0 overflow-hidden rounded-none border-x-0 border-border/70 bg-transparent shadow-none before:hidden transition-colors",
        isFirst ? "border-t-0" : "border-t",
        showBottomSeparator ? "border-b" : "border-b-0",
        isSelected ? "bg-background" : "hover:bg-background/70",
      )}
      render={
        <div
          role="button"
          tabIndex={0}
          onClick={onSelect}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect();
            }
          }}
        />
      }
    >
      <CardHeader className="gap-2 px-5 py-3">
        <InboxSourceRow articleUrl={item.link} feedTitle={item.feedTitle} />
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
        <p className="line-clamp-3 overflow-hidden text-[14px] leading-[1.45] text-muted-foreground/90">
          {item.summary || "No summary available."}
        </p>
      </CardContent>
      <CardFooter className="mt-2 flex w-full flex-wrap items-center gap-2 px-5 pb-3 pt-0">
        <PretextText
          className="line-clamp-1 text-[12px] font-medium tracking-[0.01em] text-muted-foreground/75"
          lineHeight={FOOTER_LINE_HEIGHT}
          maxLines={1}
          text={formatArticleTimestamp(item.publishedAt)}
          font={FOOTER_FONT}
          containerWidth={containerWidth}
        />
        {item.isSaved ? (
          <PretextText
            className="line-clamp-1 text-[12px] font-medium tracking-[0.01em] text-muted-foreground/75"
            lineHeight={FOOTER_LINE_HEIGHT}
            maxLines={1}
            text="Saved"
            font={FOOTER_FONT}
            containerWidth={containerWidth}
          />
        ) : null}
      </CardFooter>
    </Card>
  );
}

function PretextText({
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
  const prepared = useMemo(() => prepare(text, font), [font, text]);
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

    let low = Math.max(
      120,
      Math.ceil(Math.max(maxWidth * PRETEXT_MIN_FILL_RATIO, maxWidth - PRETEXT_MAX_TRIM)),
    );
    let high = maxWidth;
    let best = maxWidth;

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

    return Math.min(maxWidth, best + PRETEXT_WIDTH_BUFFER);
  }, [lineHeight, maxLines, maxWidth, prepared]);

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
}

function formatArticleTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
