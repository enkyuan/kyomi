"use client";

import { useEffect, useRef } from "react";
import { InboxSourceRow } from "@components/pages/inbox/inbox-source-row";
import { ReaderContent } from "@components/reader/reader-content";
import { Button } from "@components/ui/button";
import { useArticleExtraction } from "@hooks/use-article-extraction";
import type { ArticleDetailDto } from "@lib/api-schemas";

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

  useEffect(() => {
    if (!shouldAutoExtract || extractMutation.isPending) {
      return;
    }
    if (requestedExtractionForItemRef.current === item.id) {
      return;
    }

    requestedExtractionForItemRef.current = item.id;
    extractMutation.mutate();
  }, [extractMutation, item.id, shouldAutoExtract]);

  const runExtract = () => extractMutation.mutate();

  return (
    <article className="reader-content prose prose-neutral dark:prose-invert mx-auto max-w-3xl py-10 px-2">
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

      {extractMutation.isPending ? (
        <p className="not-prose mb-3 text-xs uppercase tracking-wide text-muted-foreground">
          Extracting full text…
        </p>
      ) : null}

      {showFailedBanner ? (
        <div className="not-prose mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-foreground">
          <p className="font-medium text-destructive">Couldn&apos;t load extracted text</p>
          <p className="mt-1 text-muted-foreground">{item.extractedContentError}</p>
          {canRequestExtraction ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={extractMutation.isPending}
              onClick={() => runExtract()}
            >
              {extractMutation.isPending ? "Retrying…" : "Try again"}
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
