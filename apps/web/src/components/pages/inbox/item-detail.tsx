"use client";

import { useCallback, useEffect, useRef } from "react";
import { InboxSourceRow } from "@components/pages/inbox/inbox-source-row";
import { ReaderContent } from "@components/reader/reader-content";
import { Button } from "@components/ui/button";
import { Spinner } from "@components/ui/spinner";
import { toastManager } from "@components/ui/toast";
import { useArticleExtraction } from "@hooks/use-article-extraction";
import type { ArticleDetailDto, ExtractFullTextResponseDto } from "@lib/api-schemas";
import { cn } from "@lib/utils";

function estimateReadingTime(html: string): number {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = text.split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 238));
}

export function formatArticleTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ItemDetail({ item }: { item: ArticleDetailDto }) {
  const extractMutation = useArticleExtraction(item.id);
  const requestedExtractionForItemRef = useRef<string | null>(null);

  const displayReader = item.readerExtracted ?? item.readerOriginal;

  const displayContent =
    displayReader.contentHtml ?? displayReader.contentMarkdown ?? displayReader.contentText ?? "";
  const readTime = displayContent ? estimateReadingTime(displayContent) : null;

  const canRequestExtraction = item.link.startsWith("http");
  const shouldAutoExtract =
    canRequestExtraction &&
    item.extractedContentStatus === "pending" &&
    item.readerExtracted === null;
  const showFailedBanner =
    item.extractedContentStatus === "failed" && Boolean(item.extractedContentError);

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
    <article className="reader-content prose prose-neutral dark:prose-invert relative mx-auto max-w-3xl px-2 py-10">
      {extractMutation.isPending && !showFailedBanner && !item.readerExtracted ? (
        <div className="not-prose absolute right-2 top-10 flex items-center gap-2 text-muted-foreground text-xs">
          <Spinner className="size-4" />
        </div>
      ) : null}

      <div className="not-prose mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <span>{formatArticleTimestamp(item.publishedAt)}</span>
          {readTime ? (
            <>
              <span>·</span>
              <span>{readTime} min read</span>
            </>
          ) : null}
        </div>
        <p className="text-xl font-semibold text-foreground">{item.title}</p>
        <InboxSourceRow
          articleUrl={item.link}
          feedTitle={item.feedTitle}
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
          <p className="mt-1 text-muted-foreground">{item.extractedContentError}</p>
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

      <ReaderContent reader={displayReader} />

      <div className="not-prose mt-10 border-t border-border pt-6">
        <a
          href={item.link}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
        >
          View original article →
        </a>
      </div>
    </article>
  );
}
