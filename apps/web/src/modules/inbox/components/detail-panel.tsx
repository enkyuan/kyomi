"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InboxSourceRow } from "@modules/inbox/components/source-row";
import { ReaderToolbar } from "@modules/inbox/components/reader-toolbar";
import { ReaderContent } from "@cronos/reader/web";
import { Button } from "@components/ui/button";
import { Spinner } from "@components/ui/spinner";
import { toastManager } from "@components/ui/toast";
import { updateInboxItemState, type InboxItem } from "@modules/inbox/api";
import { updateInboxItemCaches } from "@modules/inbox/lib/cache";
import { useArticleExtraction } from "@hooks/use-article-extraction";
import type {
  ArticleDetailDto,
  ExtractFullTextResponseDto,
  InboxTimestampDisplayDto,
} from "@lib/api-schemas";
import { readerContentForMode } from "@lib/reader-display";
import { useReaderPreferences } from "@lib/reader-preferences";
import { cn } from "@lib/utils";
import { formatInboxTimestamp } from "@modules/inbox/lib/format-timestamp";
import { useRelativeTimestampRefresh } from "@hooks/use-relative-timestamp-refresh";

type InboxItemPatch = Partial<Pick<InboxItem, "isRead" | "isSaved">>;

function estimateReadingTime(html: string): number {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = text.split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 238));
}

export function ItemDetail({
  item,
  showFavicons,
  timestampDisplay,
  timestampHourCycle,
  readerFocusMode = false,
}: {
  item: ArticleDetailDto;
  showFavicons: boolean;
  timestampDisplay: InboxTimestampDisplayDto;
  timestampHourCycle: "12h" | "24h";
  readerFocusMode?: boolean;
}) {
  const queryClient = useQueryClient();
  const { preferences, setPreferences, limits } = useReaderPreferences();
  const extractMutation = useArticleExtraction(item.id);
  const requestedExtractionForItemRef = useRef<string | null>(null);
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

  useRelativeTimestampRefresh(timestampDisplay);
  const effectiveReaderMode =
    preferences.defaultMode === "smart" ? item.reader.activeMode : preferences.defaultMode;
  const isViewingExtracted = effectiveReaderMode === "extracted";
  const displayReader = useMemo(
    () => readerContentForMode(item, effectiveReaderMode),
    [effectiveReaderMode, item.reader],
  );

  const displayContent = useMemo(
    () =>
      displayReader.contentHtml ?? displayReader.contentMarkdown ?? displayReader.contentText ?? "",
    [displayReader],
  );
  const readTime = displayContent ? estimateReadingTime(displayContent) : null;

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
  const effectiveContentWidth = preferences.contentWidth === "narrow" ? "narrow" : "wide";
  const maxWidthClassName =
    effectiveContentWidth === "narrow" ? "max-w-2xl" : readerFocusMode ? "max-w-6xl" : "max-w-5xl";

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

  const updateItem = useCallback(
    (patch: InboxItemPatch) => {
      updateItemMutation.mutate(patch);
    },
    [updateItemMutation],
  );

  const cycleContentWidth = useCallback(() => {
    const nextWidth = effectiveContentWidth === "narrow" ? "wide" : "narrow";
    setPreferences({ contentWidth: nextWidth });
  }, [effectiveContentWidth, setPreferences]);

  const adjustFontSize = useCallback(
    (delta: number) => {
      const nextFontSize = Math.max(
        limits.minFontSizePx,
        Math.min(limits.maxFontSizePx, preferences.fontSizePx + delta),
      );
      setPreferences({ fontSizePx: nextFontSize });
    },
    [limits.maxFontSizePx, limits.minFontSizePx, preferences.fontSizePx, setPreferences],
  );

  const handleModeChange = useCallback(
    (mode: "original" | "extracted") => {
      if (mode === "extracted" && !item.reader.extracted.available) {
        return;
      }
      setPreferences({ defaultMode: mode });
    },
    [item.reader.extracted.available, setPreferences],
  );

  const handleOpenOriginal = useCallback(() => {
    window.open(
      item.link,
      preferences.openLinksInNewTab ? "_blank" : "_self",
      preferences.openLinksInNewTab ? "noopener,noreferrer" : undefined,
    );
  }, [item.link, preferences.openLinksInNewTab]);

  const handleOpenAi = useCallback(() => {
    toastManager.add({
      title: "AI tools coming next",
      description: "This button is reserved for article-side LLM actions.",
      type: "info",
    });
  }, []);

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

  return (
    <article
      className={cn(
        "reader-content prose prose-neutral dark:prose-invert relative mx-auto px-2 pb-10",
        readerFocusMode ? "pt-5" : "pt-10",
        maxWidthClassName,
        !preferences.showImages && "reader-hide-images",
      )}
      style={{ "--reader-font-size": `${preferences.fontSizePx}px` } as Record<string, string>}
    >
      <div className="not-prose mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs uppercase tracking-wide text-muted-foreground">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span>
              {formatInboxTimestamp(item.publishedAt, timestampDisplay, timestampHourCycle)}
            </span>
            {readTime ? (
              <>
                <span>·</span>
                <span>{readTime} min read</span>
              </>
            ) : null}
          </div>
          <ReaderToolbar
            activeMode={effectiveReaderMode}
            extractedAvailable={item.reader.extracted.available}
            isSaved={item.isSaved}
            limits={limits}
            preferences={preferences}
            onAdjustFontSize={adjustFontSize}
            onCycleContentWidth={cycleContentWidth}
            onModeChange={handleModeChange}
            onOpenAi={handleOpenAi}
            onOpenOriginal={handleOpenOriginal}
            onToggleSaved={() => updateItem({ isSaved: !item.isSaved })}
          />
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="min-w-0 flex-1 text-xl font-semibold text-foreground">{item.title}</p>
        </div>
        <InboxSourceRow
          articleUrl={item.link}
          feedFaviconUrl={item.feedFaviconUrl}
          feedTitle={item.feedTitle}
          showFavicon={showFavicons}
          className=""
          labelClassName="text-sm"
        />
      </div>

      {showFailedBanner ? (
        <div
          className={cn(
            "not-prose relative mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-foreground",
            extractMutation.isPending ? "pr-11" : null,
          )}
        >
          {extractMutation.isPending ? (
            <div className="absolute right-3 top-3 text-muted-foreground" aria-hidden>
              <Spinner className="size-4" />
            </div>
          ) : null}
          <p className="font-medium text-destructive">Couldn&apos;t load extracted text</p>
          <p className="mt-1 text-muted-foreground">{item.reader.extracted.error}</p>
          {canRequestExtraction ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => runExtract("manual")}
            >
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}

      <ReaderContent
        reader={displayReader}
        openLinksInNewTab={preferences.openLinksInNewTab}
        showLinkPreviews={preferences.showLinkPreviews}
        layoutMode="fidelity"
      />
    </article>
  );
}
