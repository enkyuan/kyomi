"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { InboxSourceRow } from "@modules/inbox/components/source-row";
import { ReaderToolbar } from "@modules/inbox/components/reader-toolbar";
import { useReaderToolbarModel } from "@modules/inbox/components/reader-toolbar-model";
import { ReaderContent } from "@vols.rss/reader/web";
import { Button } from "@components/ui/button";
import { Spinner } from "@components/ui/spinner";
import type { ArticleDetailDto, InboxTimestampDisplayDto } from "@lib/api-schemas";
import { cn } from "@lib/utils";
import { formatInboxTimestamp } from "@modules/inbox/lib/format-timestamp";
import { useRelativeTimestampRefresh } from "@hooks/use-relative-timestamp-refresh";

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
  const prefersReducedMotion = useReducedMotion();
  const toolbar = useReaderToolbarModel({ item, readerFocusMode });

  useRelativeTimestampRefresh(timestampDisplay);
  const displayContent =
    toolbar.displayReader.contentHtml ??
    toolbar.displayReader.contentMarkdown ??
    toolbar.displayReader.contentText ??
    "";
  const readTime = displayContent ? estimateReadingTime(displayContent) : null;

  return (
    <article
      className={cn(toolbar.articleClassName, readerFocusMode && "w-full")}
      style={toolbar.articleStyle}
    >
      <div
        className={cn(
          "pointer-events-none sticky z-30 flex h-0 justify-center overflow-visible",
          readerFocusMode ? "top-[-0.5rem] md:top-[-1.25rem]" : "top-0",
        )}
      >
        <AnimatePresence initial={false}>
          {toolbar.showFloatingToolbar ? (
            <motion.div
              key="floating-reader-toolbar"
              animate={{
                filter: "blur(0px)",
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              className="pointer-events-auto origin-top will-change-transform"
              exit={{
                filter: "blur(4px)",
                opacity: 0,
                scale: 0.98,
                y: -12,
              }}
              initial={
                prefersReducedMotion
                  ? false
                  : {
                      filter: "blur(4px)",
                      opacity: 0,
                      scale: 0.98,
                      y: -12,
                    }
              }
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { type: "spring", duration: 0.28, bounce: 0 }
              }
            >
              <ReaderToolbar {...toolbar.toolbarProps} variant="floating" />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
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
          <div ref={toolbar.inlineToolbarRef}>
            <ReaderToolbar {...toolbar.toolbarProps} />
          </div>
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

      {toolbar.showFailedBanner ? (
        <div
          className={cn(
            "not-prose relative mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-foreground",
            toolbar.extractPending ? "pr-11" : null,
          )}
        >
          {toolbar.extractPending ? (
            <div className="absolute right-3 top-3 text-muted-foreground" aria-hidden>
              <Spinner className="size-4" />
            </div>
          ) : null}
          <p className="font-medium text-destructive">Couldn&apos;t load extracted text</p>
          <p className="mt-1 text-muted-foreground">{toolbar.extractionError}</p>
          {toolbar.canRequestExtraction ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={toolbar.onRetryExtraction}
            >
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="relative">
        <ReaderContent
          reader={toolbar.displayReader}
          openLinksInNewTab={toolbar.openLinksInNewTab}
          showLinkPreviews={toolbar.showLinkPreviews}
          layoutMode="fidelity"
        />
      </div>
    </article>
  );
}
