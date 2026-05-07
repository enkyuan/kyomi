"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toastManager } from "@components/ui/toast";
import { updateInboxItemState, type InboxItem } from "@modules/inbox/api";
import { updateInboxItemCaches } from "@modules/inbox/lib/cache";
import { useArticleExtraction } from "@hooks/use-article-extraction";
import type { ArticleDetailDto, ExtractFullTextResponseDto } from "@lib/api-schemas";
import { readerContentForMode } from "@lib/reader-display";
import { useReaderPreferences, type ReaderContentWidth } from "@lib/reader-preferences";
import { cn } from "@lib/utils";

type InboxItemPatch = Partial<Pick<InboxItem, "isRead" | "isSaved">>;

export type ReaderToolbarMode = "original" | "extracted";

export type ReaderToolbarProps = {
  isSaved: boolean;
  activeMode: ReaderToolbarMode;
  extractedAvailable: boolean;
  contentWidth: ReaderContentWidth;
  canDecreaseFont: boolean;
  canIncreaseFont: boolean;
  /** When true (reader-focused article layout), content width is layout-driven; hide the toggle. */
  readerFocusMode?: boolean;
  onToggleSaved: () => void;
  onToggleMode: () => void;
  onCycleContentWidth: () => void;
  onDecreaseFontSize: () => void;
  onIncreaseFontSize: () => void;
  onOpenOriginal: () => void;
  onOpenAi: () => void;
  variant?: "inline" | "floating";
};

export type ReaderToolbarModel = {
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
  showFloatingToolbar: boolean;
  toolbarProps: ReaderToolbarProps;
};

export function useReaderToolbarModel({
  item,
  readerFocusMode = false,
}: {
  item: ArticleDetailDto;
  readerFocusMode?: boolean;
}): ReaderToolbarModel {
  const queryClient = useQueryClient();
  const { preferences, setPreferences, limits } = useReaderPreferences();
  const extractMutation = useArticleExtraction(item.id);
  const requestedExtractionForItemRef = useRef<string | null>(null);
  const inlineToolbarRef = useRef<HTMLDivElement | null>(null);
  const [showFloatingToolbar, setShowFloatingToolbar] = useState(false);

  const updateItemMutation = useMutation({
    mutationFn: (patch: InboxItemPatch) =>
      updateInboxItemState({
        data: {
          itemId: item.id,
          ...patch,
        },
      }),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ["inbox"] });
      updateInboxItemCaches(queryClient, item.id, patch, false);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["inbox", "items"] });
      void queryClient.invalidateQueries({ queryKey: ["inbox", "view-count"] });
      void queryClient.invalidateQueries({ queryKey: ["inbox", "item-detail", item.id] });
      void queryClient.invalidateQueries({ queryKey: ["sidebar", "inbox-summary"] });
    },
  });

  const effectiveReaderMode: ReaderToolbarMode =
    preferences.defaultMode === "smart" ? item.reader.activeMode : preferences.defaultMode;
  const isViewingExtracted = effectiveReaderMode === "extracted";
  const displayReader = readerContentForMode(item, effectiveReaderMode);
  const contentWidth = preferences.contentWidth === "narrow" ? "narrow" : "wide";
  const canDecreaseFont = preferences.fontSizePx > limits.minFontSizePx;
  const canIncreaseFont = preferences.fontSizePx < limits.maxFontSizePx;
  const maxWidthClassName =
    contentWidth === "narrow" ? "max-w-2xl" : readerFocusMode ? "max-w-6xl" : "max-w-5xl";

  const canRequestExtraction = item.link.startsWith("http");
  const shouldAutoExtract =
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
        error: (error) => ({
          title: "Extraction failed",
          description:
            error instanceof Error ? error.message : "Could not fetch extracted article content.",
          type: "error",
        }),
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
        if (entry.isIntersecting) {
          setShowFloatingToolbar(false);
          return;
        }

        const rootTop = entry.rootBounds?.top ?? 0;
        const isRendered = entry.boundingClientRect.height > 0;
        const isScrolledPast = entry.boundingClientRect.bottom <= rootTop;

        setShowFloatingToolbar(isRendered && isScrolledPast);
      },
      {
        root: viewport,
        rootMargin: "0px",
        threshold: 0,
      },
    );

    observer.observe(inlineToolbarNode);

    return () => {
      observer.disconnect();
    };
  }, [readerFocusMode]);

  return {
    articleClassName: cn(
      "reader-content prose prose-neutral dark:prose-invert relative mx-auto px-2 pb-10",
      readerFocusMode ? "pt-5" : "pt-10",
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
    showFloatingToolbar,
    toolbarProps: {
      activeMode: effectiveReaderMode,
      extractedAvailable: item.reader.extracted.available,
      isSaved: item.isSaved,
      contentWidth,
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
      onOpenAi: () => {
        toastManager.add({
          title: "AI tools coming next",
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
        updateItemMutation.mutate({ isSaved: !item.isSaved });
      },
    },
  };
}
