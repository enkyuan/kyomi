"use client";

import { useCallback, useEffect, useRef } from "react";
import { InboxSourceRow } from "@modules/inbox/source-row";
import { ReaderContent } from "@modules/reader/content";
import { Button } from "@components/ui/button";
import { Spinner } from "@components/ui/spinner";
import { toastManager } from "@components/ui/toast";
import { useArticleExtraction } from "@modules/reader/use-extraction";
import type {
  ArticleDetailDto,
  ExtractFullTextResponseDto,
  InboxTimestampDisplayDto,
} from "@lib/api-schemas";
import { readerContentForMode } from "@lib/reader-display";
import { useReaderPreferences } from "@lib/reader-preferences";
import { cn } from "@lib/utils";
import { formatInboxTimestamp } from "@modules/inbox/format-timestamp";
import { useRelativeTimestampRefresh } from "@modules/inbox/use-relative-timestamp-refresh";

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
  const { preferences } = useReaderPreferences();
  const extractMutation = useArticleExtraction(item.id);
  const requestedExtractionForItemRef = useRef<string | null>(null);

  useRelativeTimestampRefresh(timestampDisplay);
  const effectiveReaderMode =
    preferences.defaultMode === "smart" ? item.reader.activeMode : preferences.defaultMode;
  const isViewingExtracted = effectiveReaderMode === "extracted";
  const displayReader = readerContentForMode(item, effectiveReaderMode);

  const displayContent =
    displayReader.contentHtml ?? displayReader.contentMarkdown ?? displayReader.contentText ?? "";
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
  const maxWidthClassName =
    preferences.contentWidth === "narrow"
      ? "max-w-2xl"
      : preferences.contentWidth === "wide"
        ? "max-w-4xl"
        : "max-w-3xl";

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
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
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

      <div className="not-prose mt-10 border-t border-border pt-6">
        <a
          href={item.link}
          target={preferences.openLinksInNewTab ? "_blank" : undefined}
          rel={preferences.openLinksInNewTab ? "noreferrer" : undefined}
          className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
        >
          View original article →
        </a>
      </div>
    </article>
  );
}
