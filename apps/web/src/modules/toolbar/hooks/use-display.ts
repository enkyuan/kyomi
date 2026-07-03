"use client";

import type { ArticleDetailDto } from "@lib/schemas/index";
import { cn } from "@kyomi/ui/lib/utils";
import { readerArticleTopInsetClass } from "@modules/reader/lib/detail-inset";
import { readerContentForMode } from "@modules/reader/lib/display";
import { useReaderPreferences, type ReaderContentWidth } from "@modules/reader/hooks/preferences";
import type { ToolbarMode } from "../lib/types";

export function useReaderDisplay({
  item,
  readerFocusMode,
}: {
  item: ArticleDetailDto;
  readerFocusMode: boolean;
}) {
  const { preferences, setPreferences, limits } = useReaderPreferences();
  const effectiveReaderMode: ToolbarMode =
    preferences.defaultMode === "smart" ? item.reader.activeMode : preferences.defaultMode;
  const contentWidth: ReaderContentWidth =
    preferences.contentWidth === "narrow" ? "narrow" : "wide";
  const maxWidthClassName =
    contentWidth === "narrow" ? "max-w-2xl" : readerFocusMode ? "max-w-none" : "max-w-5xl";

  return {
    articleClassName: cn(
      "reader-content prose prose-neutral dark:prose-invert relative mx-auto max-w-none px-1 pb-10",
      readerArticleTopInsetClass(readerFocusMode),
      maxWidthClassName,
      !preferences.showImages && "reader-hide-images",
    ),
    articleStyle: { "--reader-font-size": `${preferences.fontSizePx}px` },
    canDecreaseFont: preferences.fontSizePx > limits.minFontSizePx,
    canIncreaseFont: preferences.fontSizePx < limits.maxFontSizePx,
    contentWidth,
    displayReader: readerContentForMode(item, effectiveReaderMode),
    effectiveReaderMode,
    isViewingExtracted: effectiveReaderMode === "extracted",
    limits,
    preferences,
    setPreferences,
  };
}
