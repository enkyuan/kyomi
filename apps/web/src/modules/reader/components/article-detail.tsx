"use client";

import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { formatInboxTimestamp, InboxSourceRow } from "@modules/inbox";
import { ReaderToolbar } from "./reader-toolbar";
import { useReaderToolbarModel } from "../hooks/use-reader-toolbar-model";
import { ReaderContent } from "@vols.rss/reader/web";
import { Button } from "@components/ui/button";
import { Spinner } from "@components/ui/spinner";
import type { ArticleDetailDto, InboxTimestampDisplayDto } from "@lib/api-schemas";
import { cn } from "@lib/utils";
import { useRelativeTimestampRefresh } from "@hooks/use-relative-timestamp-refresh";
import { useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";

function estimateReadingTime(html: string): number {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = text.split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 238));
}

function useFloatingToolbarBounds(articleRef: RefObject<HTMLElement | null>, enabled: boolean) {
  const [bounds, setBounds] = useState<{ left: number; top: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!enabled) {
      setBounds(null);
      return;
    }

    const article = articleRef.current;
    const viewport = article?.closest<HTMLElement>("[data-reader-detail-viewport]");
    if (!viewport) {
      return;
    }

    const updateBounds = () => {
      const rect = viewport.getBoundingClientRect();
      setBounds({ left: rect.left, top: rect.top + 12, width: rect.width });
    };

    updateBounds();

    const resizeObserver = new ResizeObserver(updateBounds);
    resizeObserver.observe(viewport);
    window.addEventListener("resize", updateBounds);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateBounds);
    };
  }, [articleRef, enabled]);

  return bounds;
}

type ReaderToolbarModel = ReturnType<typeof useReaderToolbarModel>;

function FloatingReaderToolbar({
  toolbar,
  floatingToolbarBounds,
  prefersReducedMotion,
}: {
  toolbar: ReaderToolbarModel;
  floatingToolbarBounds: { left: number; top: number; width: number } | null;
  prefersReducedMotion: boolean;
}) {
  const isTopToolbar = toolbar.floatingToolbarEdge === "top";

  return (
    <div
      className={cn(
        "pointer-events-none fixed z-40 flex justify-center",
        toolbar.floatingToolbarEdge === "bottom" && "inset-x-0 bottom-5 md:bottom-8",
        isTopToolbar && !floatingToolbarBounds && "inset-x-0 top-3",
      )}
      style={
        isTopToolbar && floatingToolbarBounds
          ? {
              left: `${floatingToolbarBounds.left}px`,
              top: `${floatingToolbarBounds.top}px`,
              width: `${floatingToolbarBounds.width}px`,
            }
          : undefined
      }
    >
      <LazyMotion features={domAnimation}>
        <AnimatePresence initial={false}>
          {toolbar.showFloatingToolbar ? (
            <m.div
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
            </m.div>
          ) : null}
        </AnimatePresence>
      </LazyMotion>
    </div>
  );
}

function ReaderArticleHeader({
  item,
  readTime,
  showFavicons,
  timestampDisplay,
  timestampHourCycle,
  toolbar,
}: {
  item: ArticleDetailDto;
  readTime: number | null;
  showFavicons: boolean;
  timestampDisplay: InboxTimestampDisplayDto;
  timestampHourCycle: "12h" | "24h";
  toolbar: ReaderToolbarModel;
}) {
  return (
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
        <div ref={toolbar.inlineToolbarRef} className="hidden md:block">
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
  );
}

function ExtractionFailedBanner({ toolbar }: { toolbar: ReaderToolbarModel }) {
  if (!toolbar.showFailedBanner) {
    return null;
  }

  return (
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
  );
}

export function ReaderArticleDetail({
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
  const articleRef = useRef<HTMLElement>(null);
  const floatingToolbarBounds = useFloatingToolbarBounds(
    articleRef,
    toolbar.showFloatingToolbar && toolbar.floatingToolbarEdge === "top",
  );

  useRelativeTimestampRefresh(timestampDisplay);
  const displayContent =
    toolbar.displayReader.contentHtml ??
    toolbar.displayReader.contentMarkdown ??
    toolbar.displayReader.contentText ??
    "";
  const readTime = displayContent ? estimateReadingTime(displayContent) : null;

  return (
    <article
      ref={articleRef}
      className={cn(toolbar.articleClassName, readerFocusMode && "w-full")}
      style={toolbar.articleStyle}
    >
      <FloatingReaderToolbar
        toolbar={toolbar}
        floatingToolbarBounds={floatingToolbarBounds}
        prefersReducedMotion={Boolean(prefersReducedMotion)}
      />
      <ReaderArticleHeader
        item={item}
        readTime={readTime}
        showFavicons={showFavicons}
        timestampDisplay={timestampDisplay}
        timestampHourCycle={timestampHourCycle}
        toolbar={toolbar}
      />
      <ExtractionFailedBanner toolbar={toolbar} />

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
