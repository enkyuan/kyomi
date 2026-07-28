"use client";

import { toastManager } from "@kyomi/ui/atoms/toast";
import type { ArticleDetailDto } from "@lib/schemas/index";
import { useArticleActions } from "@modules/toolbar/hooks/use-article";
import { useFloatingToolbar } from "@modules/toolbar/hooks/use-floating";
import { useReaderDisplay } from "@modules/toolbar/hooks/use-display";
import { useReaderExtract } from "@modules/toolbar/hooks/use-extract";
import type { ToolbarModel } from "@modules/toolbar/lib/types";

export function useReaderToolbar({
  item,
  readerFocusMode = false,
  autoExtract = true,
}: {
  item: ArticleDetailDto;
  readerFocusMode?: boolean;
  autoExtract?: boolean;
}): ToolbarModel {
  const reader = useReaderDisplay({ item, readerFocusMode });
  const canRequestExtraction = item.link.startsWith("http");
  const extraction = useReaderExtract({
    autoExtract,
    canRequestExtraction,
    isViewingExtracted: reader.isViewingExtracted,
    item,
  });
  const floating = useFloatingToolbar({ itemId: item.id, readerFocusMode });
  const articleActions = useArticleActions({ item, saveErrorScope: "reader.saved_state" });

  return {
    articleClassName: reader.articleClassName,
    articleStyle: reader.articleStyle,
    canRequestExtraction,
    displayReader: reader.displayReader,
    extractPending: extraction.extractPending,
    extractionError: extraction.extractionError,
    floatingToolbarEdge: floating.floatingToolbarEdge,
    inlineToolbarRef: floating.inlineToolbarRef,
    onRetryExtraction: extraction.onRetryExtraction,
    openLinksInNewTab: reader.preferences.openLinksInNewTab,
    showFailedBanner: extraction.showFailedBanner,
    showFloatingToolbar: floating.showFloatingToolbar,
    showLinkPreviews: reader.preferences.showLinkPreviews,
    toolbarProps: {
      activeMode: reader.effectiveReaderMode,
      canDecreaseFont: reader.canDecreaseFont,
      canIncreaseFont: reader.canIncreaseFont,
      contentWidth: reader.contentWidth,
      extractedAvailable: item.reader.extracted.available,
      fontSizePx: reader.preferences.fontSizePx,
      isSaved: articleActions.isSaved,
      readerFocusMode,
      onCycleContentWidth: () => {
        const nextWidth = reader.contentWidth === "narrow" ? "wide" : "narrow";
        reader.setPreferences({ contentWidth: nextWidth });
      },
      onDecreaseFontSize: () => {
        reader.setPreferences({
          fontSizePx: Math.max(reader.limits.minFontSizePx, reader.preferences.fontSizePx - 1),
        });
      },
      onIncreaseFontSize: () => {
        reader.setPreferences({
          fontSizePx: Math.min(reader.limits.maxFontSizePx, reader.preferences.fontSizePx + 1),
        });
      },
      onOpenAi: () => {
        toastManager.add({
          title: "AI tools coming soon",
          type: "info",
        });
      },
      onOpenOriginal: () => {
        articleActions.openSource({ newTab: reader.preferences.openLinksInNewTab });
      },
      onShareArticle: articleActions.shareArticle,
      onToggleMode: () => {
        if (reader.effectiveReaderMode === "original") {
          if (!item.reader.extracted.available) {
            return;
          }
          reader.setPreferences({ defaultMode: "extracted" });
          return;
        }
        reader.setPreferences({ defaultMode: "original" });
      },
      onToggleSaved: articleActions.toggleSaved,
      onTranslateArticle: () => {
        toastManager.add({
          title: "Translation coming soon",
          type: "info",
        });
      },
    },
  };
}
