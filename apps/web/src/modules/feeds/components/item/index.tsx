"use client";

import { memo, type KeyboardEvent } from "react";
import { cn } from "@lib/utils";
import { SourceRow } from "./source-row";
import { ItemInlineToolbar } from "./toolbar";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@kyomi/ui/card";
import { TimestampText } from "@modules/inbox/components/timestamp-text";
import { useTimestamp } from "@hooks/use-timestamp";
import { Pretext } from "./pretext";
import { getSectionClassNames, getTypography } from "@modules/feeds/layout";
import { arePropsEqual, type Props } from "@modules/feeds/props";

const ITEM_GUTTER_CLASS = "pl-8 pr-7";
const ITEM_SEPARATOR_CLASS = "left-8 right-7";

export const Item = memo(function Item({
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
}: Props) {
  useTimestamp(timestampDisplay);
  const typography = getTypography({ density, fontSizePx, readerFocusMode });
  const sectionClassNames = getSectionClassNames({
    readerFocusMode,
    isCompact: typography.isCompact,
  });
  const {
    isCompact,
    titleFontSizePx,
    titleLineHeightPx,
    titleFont,
    summaryFontSizePx,
    summaryLineHeightPx,
    summaryMaxLines,
    summaryFont,
    metaFontSizePx,
    sourceLabelFontSizePx,
  } = typography;
  const selectItem = () => {
    onSelect(item);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectItem();
    }
  };

  return (
    <Card
      aria-label={item.title || "Untitled article"}
      className={cn(
        "group/inbox-item relative w-full cursor-pointer gap-0 overflow-visible rounded-none border-0 bg-transparent text-left shadow-none outline-none before:hidden transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)] will-change-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background active:scale-[0.996] motion-reduce:active:scale-100",
        isSelected ? "bg-background" : "hover:bg-background/55",
      )}
      onClick={selectItem}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      {!isFirst ? (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-0 h-px bg-border/70",
            ITEM_SEPARATOR_CLASS,
          )}
        />
      ) : null}
      {showBottomSeparator ? (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute bottom-0 h-px bg-border/70",
            ITEM_SEPARATOR_CLASS,
          )}
        />
      ) : null}
      <CardHeader className={cn("p-0", ITEM_GUTTER_CLASS, sectionClassNames.header)}>
        <div className="flex min-w-0 items-center justify-between gap-4">
          <SourceRow
            articleUrl={item.link}
            feedFaviconUrl={item.feedFaviconUrl}
            feedUrl={item.feedUrl}
            feedSiteUrl={item.feedSiteUrl}
            feedTitle={item.feedTitle}
            showFavicon={showFavicons}
            className={cn("min-w-0 flex-1 gap-3", isCompact && "gap-2.5")}
            iconClassName="size-5.5 rounded-[4px]"
            labelStyle={{ fontSize: `${sourceLabelFontSizePx}px` }}
            enablePreview={false}
          />
          <span
            className="shrink-0 font-medium tracking-[0.01em] text-muted-foreground/80 tabular-nums"
            style={{ fontSize: `${metaFontSizePx}px` }}
          >
            <TimestampText
              value={item.publishedAt}
              display={timestampDisplay}
              hourCycle={timestampHourCycle}
            />
          </span>
        </div>
        <CardTitle
          className="min-w-0 font-semibold tracking-[-0.012em] text-foreground"
          style={{
            fontSize: `${titleFontSizePx}px`,
            lineHeight: `${titleLineHeightPx}px`,
          }}
        >
          <Pretext
            className={cn("font-semibold tracking-[-0.012em] text-foreground", "line-clamp-2")}
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
      <CardContent className={cn("min-w-0 p-0", ITEM_GUTTER_CLASS)}>
        <Pretext
          className="overflow-hidden text-pretty text-muted-foreground/95"
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
          "flex w-full min-w-0 items-center justify-between gap-3 p-0",
          ITEM_GUTTER_CLASS,
          sectionClassNames.footer,
        )}
      >
        <ItemInlineToolbar
          item={item}
          className="-ms-1 opacity-80 transition-opacity group-hover/inbox-item:opacity-100 group-focus-within/inbox-item:opacity-100"
        />
        {item.isSaved ? (
          <span
            className="min-w-0 shrink-0 rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground/85"
            style={{ fontSize: `${metaFontSizePx}px` }}
          >
            Saved
          </span>
        ) : null}
      </CardFooter>
    </Card>
  );
}, arePropsEqual);
