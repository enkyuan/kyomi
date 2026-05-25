"use client";

import { memo } from "react";
import { cn } from "@lib/utils";
import { SourceRow } from "./source-row";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@vols.rss/ui/card";
import { formatInboxTimestamp } from "@modules/inbox/utils/format-timestamp";
import { useTimestamp } from "@hooks/use-timestamp";
import { Pretext } from "./pretext";
import { getSectionClassNames, getTypography } from "@modules/feeds/layout";
import { arePropsEqual, type Props } from "@modules/feeds/props";

export const Item = memo(function Item({
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
  onToolbarEnter,
  onToolbarLeave,
}: Props) {
  useTimestamp(timestampDisplay);
  const isReadDimmed = item.isRead && filter !== "recent";
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

  return (
    <Card
      className={cn(
        "group/inbox-item relative w-full cursor-pointer gap-0 overflow-visible rounded-none border-x-0 border-border/70 bg-transparent shadow-none before:hidden transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] will-change-transform active:scale-[0.996] motion-reduce:active:scale-100",
        isFirst ? "border-t-0" : "border-t",
        showBottomSeparator ? "border-b" : "border-b-0",
        isSelected || item.isRead ? "bg-background" : "hover:bg-background/70",
      )}
      render={
        <button
          type="button"
          aria-label={item.title || "Untitled article"}
          className="text-left"
          onBlurCapture={onToolbarLeave}
          onClick={selectItem}
          onFocusCapture={(event) => onToolbarEnter(item, event.currentTarget)}
          onPointerEnter={(event) => onToolbarEnter(item, event.currentTarget)}
          onPointerLeave={onToolbarLeave}
        />
      }
    >
      <CardHeader className={cn("px-5", sectionClassNames.header)}>
        <SourceRow
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
          <Pretext
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
        <Pretext
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
          sectionClassNames.footer,
        )}
      >
        <span
          className={cn(
            "flex min-w-0 max-w-full items-center gap-1.5 overflow-hidden font-medium tracking-[0.01em] text-muted-foreground/85",
            isReadDimmed && "text-muted-foreground/65",
          )}
          style={{ fontSize: `${metaFontSizePx}px` }}
        >
          <span className="line-clamp-1 min-w-0 overflow-hidden text-ellipsis tabular-nums">
            {formatInboxTimestamp(item.publishedAt, timestampDisplay, timestampHourCycle)}
          </span>
          {item.isSaved ? (
            <>
              <span aria-hidden="true" className="shrink-0 text-muted-foreground/50">
                ·
              </span>
              <span className="line-clamp-1 min-w-0 overflow-hidden text-ellipsis">Saved</span>
            </>
          ) : null}
        </span>
      </CardFooter>
    </Card>
  );
}, arePropsEqual);
