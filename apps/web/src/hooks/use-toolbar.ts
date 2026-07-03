"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { toastManager } from "@kyomi/ui/toast";
import { useInboxItemStateMutation } from "@modules/inbox/hooks/use-inbox-data";
import { useMediaQuery } from "@kyomi/ui/hooks/use-media-query";
import { getUserSafeErrorMessage, logClientError } from "@lib/errors";
import type { ArticleDetailDto, ExtractFullTextResponseDto } from "@lib/schemas/index";
import type { InboxItem } from "@modules/inbox/services/api";
import { readerContentForMode } from "@modules/reader/lib/display";
import { useArticleExtraction } from "@modules/reader/hooks/extraction";
import { useReaderPreferences, type ReaderContentWidth } from "@modules/reader/hooks/preferences";
import { readerArticleTopInsetClass } from "@modules/reader/lib/detail-inset";
import { cn } from "@kyomi/ui/lib/utils";

export type ToolbarMode = "original" | "extracted";

export type ToolbarProps = {
  isSaved: boolean;
  activeMode: ToolbarMode;
  extractedAvailable: boolean;
  contentWidth: ReaderContentWidth;
  fontSizePx: number;
  canDecreaseFont: boolean;
  canIncreaseFont: boolean;
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

type ArticleActionItem = Pick<
  InboxItem,
  "id" | "title" | "summary" | "feedTitle" | "link" | "isSaved"
>;

export type ItemToolbarProps = {
  className?: string;
  style?: CSSProperties;
  isSaved: boolean;
  onOpenAi?: () => void;
  onCopyLink: () => void;
  onHide: () => void;
  onOpenSource: () => void;
  onReportBrokenArticle: () => void;
  onShareArticle: () => void;
  onToggleSaved: () => void;
  presentation?: "row" | "articleHeader";
};

export type ItemToolbarModel = { toolbarProps: ItemToolbarProps };

function isFloatingToolbarVisibleForEntry(entry: IntersectionObserverEntry) {
  if (entry.isIntersecting) {
    return false;
  }

  const rootTop = entry.rootBounds?.top ?? 0;
  const isRendered = entry.boundingClientRect.height > 0;
  const isScrolledPast = entry.boundingClientRect.bottom <= rootTop;

  return isRendered && isScrolledPast;
}

function useArticleActions({
  item,
  saveErrorScope,
}: {
  item: ArticleActionItem;
  saveErrorScope: string;
}) {
  const updateItemMutation = useInboxItemStateMutation();

  const toggleSaved = useCallback(() => {
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
        logClientError(saveErrorScope, error);
        return {
          title: nextSaved ? "Unable to save article" : "Unable to update article",
          description: getUserSafeErrorMessage(error, "Try again in a moment."),
          type: "error",
        };
      },
    });
  }, [item.id, item.isSaved, saveErrorScope, updateItemMutation]);

  return {
    isSaved: item.isSaved,
    copyLink: () => {
      void copyTextToClipboard(item.link).catch(() => undefined);
    },
    hide: (removeFromList = true) => {
      updateItemMutation.mutate({
        itemId: item.id,
        patch: { isHidden: true },
        removeFromList,
      });
    },
    openSource: (options?: { newTab?: boolean }) => {
      const newTab = options?.newTab ?? true;
      window.open(
        item.link,
        newTab ? "_blank" : "_self",
        newTab ? "noopener,noreferrer" : undefined,
      );
    },
    shareArticle: () => {
      void shareArticle(item).catch(() => undefined);
    },
    toggleSaved,
  };
}

export function useReaderToolbar({
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
  const articleActions = useArticleActions({ item, saveErrorScope: "reader.saved_state" });

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
      isSaved: articleActions.isSaved,
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
        articleActions.openSource({ newTab: preferences.openLinksInNewTab });
      },
      onShareArticle: articleActions.shareArticle,
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
      onToggleSaved: articleActions.toggleSaved,
    },
  };
}

export function useItemToolbarModel({
  item,
  onReportBrokenArticle,
}: {
  item: InboxItem;
  onReportBrokenArticle?: () => void;
}): ItemToolbarModel {
  const articleActions = useArticleActions({ item, saveErrorScope: "feed.item.saved_state" });

  return {
    toolbarProps: {
      isSaved: articleActions.isSaved,
      onCopyLink: articleActions.copyLink,
      onHide: () => articleActions.hide(true),
      onOpenSource: () => articleActions.openSource({ newTab: true }),
      onReportBrokenArticle: () => onReportBrokenArticle?.(),
      onShareArticle: articleActions.shareArticle,
      onToggleSaved: articleActions.toggleSaved,
    },
  };
}

async function shareArticle(item: ArticleActionItem) {
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
