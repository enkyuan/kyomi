import type { ReaderContentWidth } from "../hooks/preferences";
import { cn } from "@kyomi/ui/lib/utils";

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
