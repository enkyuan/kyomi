"use client";

import { useEffect, useState } from "react";
import { InboxSourceRow } from "@components/pages/inbox/inbox-source-row";
import { ReaderContent } from "@components/reader/reader-content";
import {
  extractInboxItemFullText,
  getInboxItemDetail,
  type ReaderContentResponse,
} from "@lib/inbox-functions";
import { Skeleton } from "@components/ui/skeleton";

/** Content sources that haven't gone through Readability — always extract. */
const UNEXTRACTED_SOURCES = new Set([null, "text_fallback", "feed_markdown", "feed_summary"]);
const extractionResultCache = new Map<string, ReaderContentResponse>();
const extractionRequestCache = new Map<string, Promise<ReaderContentResponse>>();

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

export function ItemDetail({
  item,
}: {
  item: NonNullable<Awaited<ReturnType<typeof getInboxItemDetail>>["item"]>;
}) {
  const [readerOverride, setReaderOverride] = useState<ReaderContentResponse | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  useEffect(() => {
    const cachedReader = extractionResultCache.get(item.id);
    setReaderOverride(cachedReader ?? null);
    setIsExtracting(false);

    // Extract if the backend flagged it, OR if the content source is a raw
    // RSS text/markdown blob (no Readability-parsed HTML available yet).
    const needsExtraction =
      item.reader.shouldExtract || UNEXTRACTED_SOURCES.has(item.reader.contentSource);

    if (!needsExtraction) return;
    if (cachedReader) return;

    let cancelled = false;
    setIsExtracting(true);
    const request =
      extractionRequestCache.get(item.id) ??
      extractInboxItemFullText({ data: { itemId: item.id } })
        .then((result) => {
          extractionResultCache.set(item.id, result.reader);
          return result.reader;
        })
        .catch((error: unknown) => {
          const fallbackReader: ReaderContentResponse = {
            ...item.reader,
            notice: "Full preview unavailable right now.",
            contentStatus: item.reader.fallbackSummary ? "partial" : "failed",
            extractionErrorCode: "FETCH_FAILED",
            extractionErrorMessage:
              error instanceof Error ? error.message : "Failed to extract full text.",
            shouldExtract: false,
          };
          extractionResultCache.set(item.id, fallbackReader);
          return fallbackReader;
        })
        .finally(() => {
          extractionRequestCache.delete(item.id);
        });
    extractionRequestCache.set(item.id, request);

    request
      .then((reader) => {
        if (cancelled) return;
        setReaderOverride(reader);
      })
      .finally(() => {
        if (cancelled) return;
        setIsExtracting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [item.id, item.reader]);

  const reader = readerOverride ?? item.reader;

  const displayContent = reader.contentHtml ?? reader.contentMarkdown ?? reader.contentText ?? "";
  const readTime = displayContent ? estimateReadingTime(displayContent) : null;

  return (
    <article className="reader-content prose prose-neutral dark:prose-invert mx-auto max-w-3xl py-10 px-2">
      {/* Header */}
      <div className="not-prose mb-6 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <span>{formatArticleTimestamp(item.publishedAt)}</span>
          {readTime && (
            <>
              <span>·</span>
              <span>{readTime} min read</span>
            </>
          )}
        </div>
        <p className="text-xl font-semibold text-foreground">{item.title}</p>
        <InboxSourceRow
          articleUrl={item.link}
          feedTitle={item.feedTitle}
          className=""
          labelClassName="text-sm"
        />
      </div>

      {/* Extraction loading state */}
      {isExtracting && (
        <div className="not-prose space-y-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Extracting full text…
          </p>
          <div className="space-y-2">
            <Skeleton className="h-4 w-[92%]" />
            <Skeleton className="h-4 w-[86%]" />
            <Skeleton className="h-4 w-[90%]" />
            <Skeleton className="h-4 w-[84%]" />
          </div>
        </div>
      )}

      {/* Article body */}
      {!isExtracting && <ReaderContent reader={reader} />}

      {/* Footer link */}
      <div className="not-prose mt-10 border-t border-border pt-6">
        <a
          href={item.link}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
        >
          View original article →
        </a>
      </div>
    </article>
  );
}
