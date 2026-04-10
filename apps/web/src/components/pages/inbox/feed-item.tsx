"use client";

import { layout, prepare } from "@chenglou/pretext";
import { useEffect, useMemo, useRef, useState } from "react";
import { RssFill } from "@mingcute/react";
import type { InboxItem } from "@lib/inbox-functions";
import { cn } from "@lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@components/ui/card";

const FEED_META_FONT = '500 13px "Inter Variable"';
const FEED_META_LINE_HEIGHT = 18;
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
  onSelect,
}: {
  item: InboxItem;
  isSelected: boolean;
  isFirst: boolean;
  showBottomSeparator: boolean;
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
      onClick={onSelect}
    >
      <CardHeader className="gap-2 px-5 py-3">
        <div className="flex w-full items-center gap-2">
          <FeedFavicon feedTitle={item.feedTitle} articleUrl={item.link} />
          <CardDescription className="min-w-0 text-[12px] text-muted-foreground/85">
            <PretextText
              className="line-clamp-1 text-[12px] font-medium tracking-[0.015em] text-muted-foreground/85"
              lineHeight={FEED_META_LINE_HEIGHT}
              maxLines={1}
              text={getSourceLabel(item.link, item.feedTitle)}
              font={FEED_META_FONT}
            />
          </CardDescription>
        </div>
        <CardTitle className="min-w-0 text-[16px] font-semibold leading-5.5 tracking-[-0.012em] text-foreground">
          <PretextText
            className="line-clamp-2 text-[16px] font-semibold leading-5.5 tracking-[-0.012em] text-foreground"
            lineHeight={TITLE_LINE_HEIGHT}
            maxLines={2}
            text={item.title}
            font={TITLE_FONT}
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
        />
        {item.isSaved ? (
          <PretextText
            className="line-clamp-1 text-[12px] font-medium tracking-[0.01em] text-muted-foreground/75"
            lineHeight={FOOTER_LINE_HEIGHT}
            maxLines={1}
            text="Saved"
            font={FOOTER_FONT}
          />
        ) : null}
      </CardFooter>
    </Card>
  );
}

function getSourceLabel(articleUrl: string, fallback: string) {
  try {
    const hostname = new URL(articleUrl).hostname.replace(/^www\./i, "");
    if (!hostname || hostname === "news.ycombinator.com") {
      return fallback;
    }
    return hostname;
  } catch {
    return fallback;
  }
}

function FeedFavicon({ feedTitle, articleUrl }: { feedTitle: string; articleUrl: string }) {
  const [errored, setErrored] = useState(false);
  const faviconUrl = useMemo(() => {
    if (errored) {
      return null;
    }
    try {
      const parsed = new URL(articleUrl);
      return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(parsed.origin)}`;
    } catch {
      return null;
    }
  }, [articleUrl, errored]);

  return (
    <span className="inline-flex size-4.5 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted">
      {faviconUrl ? (
        <img
          alt={`${feedTitle} favicon`}
          className="size-4"
          loading="lazy"
          src={faviconUrl}
          onError={(event) => {
            event.preventDefault();
            setErrored(true);
          }}
        />
      ) : (
        <RssFill className="size-3 text-muted-foreground" aria-label={`${feedTitle} feed`} />
      )}
    </span>
  );
}

function PretextText({
  text,
  font,
  lineHeight,
  maxLines,
  className,
}: {
  text: string;
  font: string;
  lineHeight: number;
  maxLines: number;
  className?: string;
}) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const prepared = useMemo(() => prepare(text, font), [font, text]);
  const [maxWidth, setMaxWidth] = useState<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    const parent = element?.parentElement;
    if (!element || !parent) {
      return;
    }

    const updateWidth = () => {
      setMaxWidth(parent.clientWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

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
