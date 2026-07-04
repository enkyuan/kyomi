"use client";

import { memo, type KeyboardEvent } from "react";
import { m } from "motion/react";
import { cn } from "@kyomi/ui/lib/utils";
import { SourceRow } from "./source-row";
import { TagChipRow } from "./tag-chip-row";
import { ItemInlineToolbar } from "./toolbar/inline";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@kyomi/ui/card";
import { Timestamp } from "@modules/inbox/components/timestamp";
import { useTimestamp } from "@hooks/use-timestamp";
import { usePretextLayout } from "@hooks/use-pretext";
import { getSectionClassNames, getTypography } from "@modules/feeds/lib/layout";
import { arePropsEqual, type Props } from "@modules/feeds/lib/props";

const ITEM_GUTTER_CLASS = "px-10.5";
const ITEM_SEPARATOR_CLASS = "left-10.5 right-10.5";

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
        "group/inbox-item relative w-full cursor-pointer gap-0 overflow-visible rounded-none border-0 bg-transparent text-left shadow-none outline-none before:hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
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
            iconClassName="size-5.5 rounded-sm"
            labelStyle={{ fontSize: `${sourceLabelFontSizePx}px` }}
            enablePreview={false}
            layoutId={`inbox-item-${item.id}-source`}
          />
          <m.span
            layoutId={`inbox-item-${item.id}-timestamp`}
            className="shrink-0 font-medium tracking-[0.01em] text-muted-foreground/80 tabular-nums"
            style={{ fontSize: `${metaFontSizePx}px` }}
            transition={{ type: "spring", duration: 0.28, bounce: 0 }}
          >
            <Timestamp
              value={item.publishedAt}
              display={timestampDisplay}
              hourCycle={timestampHourCycle}
            />
          </m.span>
        </div>
        <CardTitle className="min-w-0 font-semibold tracking-[-0.012em] text-foreground">
          <m.div
            layoutId={`inbox-item-${item.id}-title`}
            transition={{ type: "spring", duration: 0.28, bounce: 0 }}
          >
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
          </m.div>
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
                className="min-w-0 shrink-0 rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground/85"
                style={{ fontSize: `${metaFontSizePx}px` }}
              >
                Saved
              </span>
            ) : null}
            <TagChipRow categories={item.categories} fontSizePx={metaFontSizePx} />
          </div>
        ) : null}
        <ItemInlineToolbar item={item} />
      </CardFooter>
    </Card>
  );
}, arePropsEqual);
