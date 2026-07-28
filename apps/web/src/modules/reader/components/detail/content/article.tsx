"use client";

import { LeftFill } from "@kyomi/ui/icons/mingcute";
import { Button } from "@kyomi/ui/atoms/button";
import type {
  ArticleDetailDto,
  InboxDensityDto,
  InboxTimestampDisplayDto,
} from "@lib/schemas/index";
import { Article } from "../../article";

export function ArticleContent({
  item,
  density,
  fontSizePx,
  showFavicons,
  timestampDisplay,
  timestampHourCycle,
  showBackToList,
  onBackToList,
  isBrowserSurface,
}: {
  item: ArticleDetailDto;
  density: InboxDensityDto;
  fontSizePx: number;
  showFavicons: boolean;
  timestampDisplay: InboxTimestampDisplayDto;
  timestampHourCycle: "12h" | "24h";
  showBackToList: boolean;
  onBackToList?: () => void;
  isBrowserSurface: boolean;
}) {
  return (
    <>
      {showBackToList ? (
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="mb-3 max-md:aspect-square max-md:px-0 md:h-8 md:gap-2 md:px-[calc(--spacing(2.5)-1px)]"
          onClick={onBackToList}
          aria-label="Back to feed"
        >
          <LeftFill className="size-4" />
          <span className="hidden md:inline">Back to feed</span>
        </Button>
      ) : null}
      <Article
        item={item}
        density={density}
        fontSizePx={fontSizePx}
        showFavicons={showFavicons}
        timestampDisplay={timestampDisplay}
        timestampHourCycle={timestampHourCycle}
        readerFocusMode={showBackToList || isBrowserSurface}
        hideInlineToolbar={isBrowserSurface}
      />
    </>
  );
}
