"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toastManager } from "@kyomi/ui/toast";
import { useInboxItemStateMutation } from "@modules/inbox/hooks/use-inbox-data";
import { useMediaQuery } from "@hooks/use-media-query";
import { getUserSafeErrorMessage, logClientError } from "@lib/errors";
import type { ArticleDetailDto, ExtractFullTextResponseDto } from "@lib/schemas";
import { readerContentForMode } from "../reader-display";
import { useArticleExtraction } from "./use-article-extraction";
import { useReaderPreferences, type ReaderContentWidth } from "./use-reader-preferences";
import { readerArticleTopInsetClass } from "../lib/detail-inset";
import { cn } from "@lib/utils";

export type ToolbarMode = "original" | "extracted";

export type ToolbarProps = {
  isSaved: boolean;
  activeMode: ToolbarMode;
  extractedAvailable: boolean;
  contentWidth: ReaderContentWidth;
  fontSizePx: number;
  canDecreaseFont: boolean;
  canIncreaseFont: boolean;
  /** When true (reader-focused article layout), content width is layout-driven; hide the toggle. */
  readerFocusMode?: boolean;
  onToggleSaved: () => void;
  onToggleMode: () => void;
  onCycleContentWidth: () => void;
  onDecreaseFontSize: () => void;
  onIncreaseFontSize: () => void;
  onTranslateArticle: () => void;
  onOpenOriginal: () => void;
  onOpenAi: () => void;
  onShareArticle: () => void;
  variant?: "inline" | "floating";
  controlSize?: "default" | "large";
  hideFontControls?: boolean;
  readerFocusVariant?: "full" | "compact";
  tooltipSide?: "top" | "bottom" | "left" | "right";
  tooltipCollisionAvoidance?:
    | {
        side?: "flip" | "none";
        align?: "flip" | "shift" | "none";
        fallbackAxisSide?: "start" | "end" | "none";
      }
    | {
        side?: "shift" | "none";
        align?: "shift" | "none";
        fallbackAxisSide?: "start" | "end" | "none";
      };
};

export type ToolbarModel = {
  articleClassName: string;
  articleStyle: Record<string, string>;
  canRequestExtraction: boolean;
  displayReader: ArticleDetailDto["reader"]["selected"];
  extractPending: boolean;
  extractionError: string | null;
  inlineToolbarRef: React.RefObject<HTMLDivElement | null>;
  onRetryExtraction: () => void;
  openLinksInNewTab: boolean;
  showLinkPreviews: boolean;
  showFailedBanner: boolean;
  floatingToolbarEdge: "top" | "bottom";
  showFloatingToolbar: boolean;
  toolbarProps: ToolbarProps;
};

function isFloatingToolbarVisibleForEntry(entry: IntersectionObserverEntry) {
  if (entry.isIntersecting) {
    return false;
  }

  const rootTop = entry.rootBounds?.top ?? 0;
  const isRendered = entry.boundingClientRect.height > 0;
  const isScrolledPast = entry.boundingClientRect.bottom <= rootTop;

  return isRendered && isScrolledPast;
}

export function useToolbar({
  item,
  readerFocusMode = false,
  autoExtract = true,
}: {
  item: ArticleDetailDto;
  readerFocusMode?: boolean;
  autoExtract?: boolean;
}): ToolbarModel {
  const { preferences, setPreferences, limits } = useReaderPreferences();
  const isMobile = useMediaQuery({ max: "md" });
  const extractMutation = useArticleExtraction(item.id);
  const requestedExtractionForItemRef = useRef<string | null>(null);
  const inlineToolbarRef = useRef<HTMLDivElement | null>(null);
  const [desktopFloatingToolbarVisible, setDesktopFloatingToolbarVisible] = useState(false);

  const updateItemMutation = useInboxItemStateMutation();

  const effectiveReaderMode: ToolbarMode =
    preferences.defaultMode === "smart" ? item.reader.activeMode : preferences.defaultMode;
  const isViewingExtracted = effectiveReaderMode === "extracted";
  const displayReader = readerContentForMode(item, effectiveReaderMode);
  const contentWidth = preferences.contentWidth === "narrow" ? "narrow" : "wide";
  const canDecreaseFont = preferences.fontSizePx > limits.minFontSizePx;
  const canIncreaseFont = preferences.fontSizePx < limits.maxFontSizePx;
  const maxWidthClassName =
    contentWidth === "narrow" ? "max-w-2xl" : readerFocusMode ? "max-w-none" : "max-w-5xl";

  const canRequestExtraction = item.link.startsWith("http");
  const shouldAutoExtract =
    autoExtract &&
    canRequestExtraction &&
    item.reader.extracted.status === "pending" &&
    item.reader.extracted.content === null;
  const showFailedBanner =
    isViewingExtracted &&
    item.reader.extracted.status === "failed" &&
    item.reader.extracted.content === null &&
    Boolean(item.reader.extracted.error);

  const runExtract = useCallback(
    (reason: "auto" | "manual") => {
      if (extractMutation.isPending) {
        return;
      }

      const extractionPromise = extractMutation
        .mutateAsync()
        .then((result: ExtractFullTextResponseDto) => {
          if (!result.ok) {
            const detail = [result.errorMessage, result.errorCode].filter(Boolean).join(" ");
            throw new Error(detail || "Extraction failed");
          }
          return result;
        });

      if (reason === "auto") {
        void extractionPromise.catch(() => {
          requestedExtractionForItemRef.current = null;
        });
        return;
      }

      void toastManager.promise(extractionPromise, {
        loading: {
          title: "Extracting full text...",
          description: "Fetching full article text.",
          type: "loading",
          timeout: 0,
        },
        success: {
          title: "Full text ready",
          description: "Article content has been refreshed.",
          type: "success",
        },
        error: (error) => {
          logClientError("reader.extract", error);
          return {
            title: "Extraction failed",
            description: getUserSafeErrorMessage(
              error,
              "Could not fetch extracted article content.",
            ),
            type: "error",
          };
        },
      });
    },
    [extractMutation],
  );

  useEffect(() => {
    if (!shouldAutoExtract || extractMutation.isPending) {
      return;
    }
    if (requestedExtractionForItemRef.current === item.id) {
      return;
    }

    requestedExtractionForItemRef.current = item.id;
    runExtract("auto");
  }, [extractMutation.isPending, item.id, runExtract, shouldAutoExtract]);

  useEffect(() => {
    if (isMobile) {
      return;
    }

    const inlineToolbarNode = inlineToolbarRef.current;
    if (!inlineToolbarNode || typeof window === "undefined") {
      return;
    }

    const viewport = inlineToolbarNode.closest<HTMLElement>("[data-reader-detail-viewport]");
    if (!viewport || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setDesktopFloatingToolbarVisible(isFloatingToolbarVisibleForEntry(entry));
      },
      {
        root: viewport,
        rootMargin: "0px",
        threshold: 0,
      },
    );

    // oxlint-disable-next-line react-doctor/no-adjust-state-on-prop-change
    observer.observe(inlineToolbarNode);

    return () => {
      observer.disconnect();
    };
  }, [isMobile, item.id, readerFocusMode]);

  return {
    articleClassName: cn(
      "reader-content prose prose-neutral dark:prose-invert relative mx-auto max-w-none px-1 pb-10",
      readerArticleTopInsetClass(readerFocusMode),
      maxWidthClassName,
      !preferences.showImages && "reader-hide-images",
    ),
    articleStyle: { "--reader-font-size": `${preferences.fontSizePx}px` },
    canRequestExtraction,
    displayReader,
    extractPending: extractMutation.isPending,
    extractionError: item.reader.extracted.error,
    inlineToolbarRef,
    onRetryExtraction: () => runExtract("manual"),
    openLinksInNewTab: preferences.openLinksInNewTab,
    showLinkPreviews: preferences.showLinkPreviews,
    showFailedBanner,
    floatingToolbarEdge: isMobile ? "bottom" : "top",
    showFloatingToolbar: isMobile || desktopFloatingToolbarVisible,
    toolbarProps: {
      activeMode: effectiveReaderMode,
      extractedAvailable: item.reader.extracted.available,
      isSaved: item.isSaved,
      contentWidth,
      fontSizePx: preferences.fontSizePx,
      canDecreaseFont,
      canIncreaseFont,
      readerFocusMode,
      onCycleContentWidth: () => {
        const nextWidth = contentWidth === "narrow" ? "wide" : "narrow";
        setPreferences({ contentWidth: nextWidth });
      },
      onDecreaseFontSize: () => {
        setPreferences({ fontSizePx: Math.max(limits.minFontSizePx, preferences.fontSizePx - 1) });
      },
      onIncreaseFontSize: () => {
        setPreferences({ fontSizePx: Math.min(limits.maxFontSizePx, preferences.fontSizePx + 1) });
      },
      onTranslateArticle: () => {
        toastManager.add({
          title: "Translation coming soon",
          description: "This button is reserved for article translation.",
          type: "info",
        });
      },
      onOpenAi: () => {
        toastManager.add({
          title: "AI tools coming soon",
          description: "This button is reserved for article-side LLM actions.",
          type: "info",
        });
      },
      onOpenOriginal: () => {
        window.open(
          item.link,
          preferences.openLinksInNewTab ? "_blank" : "_self",
          preferences.openLinksInNewTab ? "noopener,noreferrer" : undefined,
        );
      },
      onShareArticle: () => {
        void shareArticle(item).catch(() => undefined);
      },
      onToggleMode: () => {
        if (effectiveReaderMode === "original") {
          if (!item.reader.extracted.available) {
            return;
          }
          setPreferences({ defaultMode: "extracted" });
          return;
        }
        setPreferences({ defaultMode: "original" });
      },
      onToggleSaved: () => {
        const nextSaved = !item.isSaved;
        const savePromise = updateItemMutation.mutateAsync({
          itemId: item.id,
          patch: { isSaved: nextSaved },
        });

        void toastManager.promise(savePromise, {
          loading: {
            title: nextSaved ? "Saving article..." : "Removing from read later...",
            description: nextSaved ? "Adding this article to read later." : "Updating read later.",
            type: "loading",
            timeout: 0,
          },
          success: {
            title: nextSaved ? "Saved to read later" : "Removed from read later",
            description: nextSaved
              ? "This article is now in read later."
              : "This article was removed from read later.",
            type: nextSaved ? "success" : "info",
          },
          error: (error) => {
            logClientError("reader.saved_state", error);
            return {
              title: nextSaved ? "Unable to save article" : "Unable to update article",
              description: getUserSafeErrorMessage(error, "Try again in a moment."),
              type: "error",
            };
          },
        });
      },
    },
  };
}

async function shareArticle(item: ArticleDetailDto) {
  const shareData: ShareData = {
    title: item.title,
    text: item.summary ?? item.feedTitle,
    url: item.link,
  };

  if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
    await navigator.share(shareData);
    return;
  }

  await copyTextToClipboard(item.link);
}

async function copyTextToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Fall back to the legacy copy path below.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  textarea.style.position = "fixed";
  textarea.style.top = "0";

  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}
