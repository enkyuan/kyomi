"use client";

import { memo, type KeyboardEvent } from "react";
import { cn } from "@kyomi/ui/lib/utils";
import { Categories } from "./categories";
import { Source } from "./source";
import { ItemInlineToolbar } from "./toolbar/inline";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@kyomi/ui/atoms/card";
import { Timestamp } from "@modules/inbox/components/timestamp";
import { useTimestamp } from "@hooks/use-timestamp";
import { usePretextLayout } from "@kyomi/ui/hooks/use-pretext";
import { getSectionClassNames, getTypography } from "@modules/feeds/lib/layout";
import { arePropsEqual, type Props } from "@modules/feeds/lib/props";

const ITEM_INSET_CLASS = "mx-10.5";
const ITEM_GUTTER_CLASS = "px-0";
const ITEM_SEPARATOR_CLASS = "left-0 right-0";

export const Item = memo(function Item({
  item,
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
  onIntent,
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
  const summaryText = item.summary || "No summary available.";
  const titlePretext = usePretextLayout({
    text: item.title,
    font: titleFont,
    lineHeight: titleLineHeightPx,
    maxLines: 2,
    containerWidth,
  });
  const summaryPretext = usePretextLayout({
    text: summaryText,
    font: summaryFont,
    lineHeight: summaryLineHeightPx,
    maxLines: summaryMaxLines,
    containerWidth,
  });
  const selectItem = () => {
    onSelect(item);
  };
  const signalIntent = () => {
    onIntent?.(item);
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
        "group/inbox-item relative w-auto cursor-pointer gap-0 overflow-visible rounded-none border-0 bg-transparent text-left shadow-none outline-none before:hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        ITEM_INSET_CLASS,
      )}
      onClick={selectItem}
      onFocus={signalIntent}
      onKeyDown={handleKeyDown}
      onPointerEnter={signalIntent}
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
          <Source
            articleUrl={item.link}
            feedId={item.feedId}
            feedFaviconUrl={item.feedFaviconUrl}
            feedUrl={item.feedUrl}
            feedSiteUrl={item.feedSiteUrl}
            feedTitle={item.feedTitle}
            showFavicon={showFavicons}
            className={cn("min-w-0 flex-1 gap-3", isCompact && "gap-2.5")}
            iconClassName="size-5.5 rounded-sm"
            labelStyle={{ fontSize: `${sourceLabelFontSizePx}px` }}
            enablePreview={false}
          />
          <span
            className="shrink-0 font-medium tracking-[0.01em] text-muted-foreground/80 tabular-nums"
            style={{ fontSize: `${metaFontSizePx}px` }}
          >
            <Timestamp
              value={item.publishedAt}
              display={timestampDisplay}
              hourCycle={timestampHourCycle}
            />
          </span>
        </div>
        <CardTitle className="min-w-0 font-semibold tracking-[-0.012em] text-foreground">
          <p
            ref={titlePretext.ref}
            className={cn(
              "w-full font-semibold tracking-[-0.012em] text-foreground",
              "line-clamp-2",
            )}
            style={{
              maxWidth: titlePretext.fittedWidth ? `${titlePretext.fittedWidth}px` : undefined,
              fontSize: `${titleFontSizePx}px`,
              lineHeight: `${titleLineHeightPx}px`,
            }}
          >
            {item.title}
          </p>
        </CardTitle>
      </CardHeader>
      <CardContent className={cn("min-w-0 p-0", ITEM_GUTTER_CLASS)}>
        <p
          ref={summaryPretext.ref}
          className="w-full overflow-hidden text-pretty text-muted-foreground/95"
          style={{
            maxWidth: summaryPretext.fittedWidth ? `${summaryPretext.fittedWidth}px` : undefined,
            display: "-webkit-box",
            fontSize: `${summaryFontSizePx}px`,
            lineHeight: `${summaryLineHeightPx}px`,
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: summaryMaxLines,
          }}
        >
          {summaryText}
        </p>
      </CardContent>
      <CardFooter
        className={cn(
          "flex w-full min-w-0 items-center justify-end gap-3 p-0",
          ITEM_GUTTER_CLASS,
          sectionClassNames.footer,
        )}
      >
        {item.isSaved || item.categories.length > 0 ? (
          <div className="me-auto flex min-w-0 items-center gap-1.5">
            {item.isSaved ? (
              <span
                className="min-w-0 shrink-0 rounded-full bg-mizu/8 px-2 py-0.5 font-medium text-mizu-foreground dark:bg-mizu/16"
                style={{ fontSize: `${metaFontSizePx}px` }}
              >
                Saved
              </span>
            ) : null}
            <Categories categories={item.categories} fontSizePx={metaFontSizePx} />
          </div>
        ) : null}
        <ItemInlineToolbar item={item} />
      </CardFooter>
    </Card>
  );
}, arePropsEqual);
