import type { ReactNode } from "react";
import { cn } from "@kyomi/ui/lib/utils";
import type {
  ArticleDetailDto,
  InboxDensityDto,
  InboxTimestampDisplayDto,
} from "@kyomi/reader/schemas";
import type { ReaderContentWidth } from "./preferences";

export type ArticleStepDirection = 1 | -1;
export type DetailSurface = "browser" | "card";

export type ReaderDetailState =
  | { status: "selected"; item: ArticleDetailDto }
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "empty" };

export type DetailHeaderState = {
  readerControlsCollapsed: boolean;
};

export interface DetailViewProps {
  detailState: ReaderDetailState;
  density: InboxDensityDto;
  fontSizePx: number;
  showFavicons: boolean;
  timestampDisplay: InboxTimestampDisplayDto;
  timestampHourCycle: "12h" | "24h";
  showBackToList?: boolean;
  onBackToList?: () => void;
  surface?: DetailSurface;
  header?: ReactNode | ((state: DetailHeaderState) => ReactNode);
  articleContentKey?: string;
  articleStepDirection?: ArticleStepDirection;
}

/** Horizontal gutter on `[data-reader-detail-content]` inside the scroll viewport. */
function readerViewportHorizontalInsetClass(contentWidth: ReaderContentWidth): string {
  return contentWidth === "narrow" ? "px-2 md:px-3" : "px-22";
}

export function readerViewportContentInsetClass({
  showBackToList,
  contentWidth,
}: {
  showBackToList: boolean;
  contentWidth: ReaderContentWidth;
}): string {
  return cn(
    "box-border w-full min-w-0",
    readerViewportHorizontalInsetClass(contentWidth),
    showBackToList ? "pt-3 pb-3 md:pt-8 md:pb-8" : "pt-0 pb-0",
  );
}

/** Top spacing below the detail chrome / back control (article stays `px-1`). */
export function readerArticleTopInsetClass(readerFocusMode: boolean): string {
  return readerFocusMode ? "pt-5" : "pt-10";
}
