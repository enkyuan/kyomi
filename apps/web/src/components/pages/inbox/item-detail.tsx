"use client";

import { useMemo } from "react";
import { InboxSourceRow } from "@components/pages/inbox/inbox-source-row";
import { ReaderContent } from "@components/reader/reader-content";
import { getInboxItemDetail, type ReaderContentResponse } from "@lib/inbox-functions";

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
  const extractedReader = useMemo(() => buildExtractedReader(item), [item]);
  const defaultMode = resolveDefaultReaderMode(item);
  const reader = defaultMode === "extracted" && extractedReader ? extractedReader : item.reader;

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

      {/* Article body */}
      <ReaderContent reader={reader} />

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

function hasRenderableContent(reader: ReaderContentResponse): boolean {
  return Boolean(
    reader.contentHtml?.trim() || reader.contentMarkdown?.trim() || reader.contentText?.trim(),
  );
}

function originalLooksWeak(
  item: NonNullable<Awaited<ReturnType<typeof getInboxItemDetail>>["item"]>,
) {
  const text = (item.reader.contentText ?? "").trim();
  return (
    item.reader.bodyKind === "fallback" ||
    item.reader.contentStatus !== "ready" ||
    (item.reader.contentSource !== "feed_html" && text.length < 280)
  );
}

type ReaderMode = "original" | "extracted";

function resolveDefaultReaderMode(
  item: NonNullable<Awaited<ReturnType<typeof getInboxItemDetail>>["item"]>,
): ReaderMode {
  const extractedReady = item.extractedContentStatus === "ready";
  const originalUsable = hasRenderableContent(item.reader) && item.reader.bodyKind !== "fallback";
  const originalBad = !originalUsable || originalLooksWeak(item);

  if (extractedReady && originalBad) return "extracted";
  if (originalUsable) return "original";
  if (extractedReady) return "extracted";
  return "original";
}

function buildExtractedReader(
  item: NonNullable<Awaited<ReturnType<typeof getInboxItemDetail>>["item"]>,
): ReaderContentResponse | null {
  if (item.extractedContentStatus !== "ready") {
    return null;
  }

  const html = item.extractedContentHtml?.trim() || null;
  const text = item.extractedContentText?.trim() || null;
  if (!html && !text) {
    return null;
  }

  return {
    ...item.reader,
    contentStatus: "ready",
    contentSource: "extracted_html",
    bodyKind: html ? "html" : "text",
    contentHtml: html,
    contentMarkdown: null,
    contentText: text,
    fallbackSummary: null,
    fallbackReason: null,
    notice: null,
    extractionErrorCode: null,
    extractionErrorMessage: null,
    shouldExtract: false,
  };
}
