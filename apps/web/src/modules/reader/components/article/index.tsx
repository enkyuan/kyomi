"use client";

import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { Timestamp } from "@modules/inbox/components/timestamp";
import { SourceRow } from "@modules/feeds/components/item/source-row";
import { getTypography } from "@modules/feeds/lib/layout";
import { Toolbar } from "../toolbar";
import { useReaderToolbar } from "@hooks/use-toolbar";
import type { ToolbarModel } from "@modules/toolbar/lib/types";
import { ReaderContent } from "@kyomi/reader/web";
import { Button } from "@kyomi/ui/button";
import { Spinner } from "@kyomi/ui/spinner";
import type {
  ArticleDetailDto,
  InboxDensityDto,
  InboxTimestampDisplayDto,
} from "@lib/schemas/index";
import { cn } from "@kyomi/ui/lib/utils";
import { useTimestamp } from "@hooks/use-timestamp";
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

function hasReaderArticleBody(reader: ToolbarModel["displayReader"]): boolean {
  if (reader.bodyKind === "html") {
    return Boolean(reader.contentHtml?.trim());
  }
  if (reader.bodyKind === "markdown") {
    return Boolean(reader.contentMarkdown?.trim());
  }
  if (reader.bodyKind === "text") {
    return Boolean(reader.contentText?.trim());
  }
  return false;
}

function getReaderSourceLayoutId(item: ArticleDetailDto) {
  const sourceIdentity = item.feedUrl ?? item.feedSiteUrl ?? item.feedTitle;
  const normalizedSourceIdentity = sourceIdentity.trim().toLowerCase();

  if (!normalizedSourceIdentity) {
    return undefined;
  }

  let hash = 0;
  for (const character of normalizedSourceIdentity) {
    hash = (hash * 31 + character.charCodeAt(0)) % 2_147_483_647;
  }

  return `reader-source-${hash.toString(36)}`;
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

function FloatingReaderToolbar({
  toolbar,
  floatingToolbarBounds,
  prefersReducedMotion,
}: {
  toolbar: ToolbarModel;
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
              <Toolbar {...toolbar.toolbarProps} variant="floating" />
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
  density,
  fontSizePx,
  showFavicons,
  timestampDisplay,
  timestampHourCycle,
  toolbar,
  hideInlineToolbar,
}: {
  item: ArticleDetailDto;
  readTime: number | null;
  density: InboxDensityDto;
  fontSizePx: number;
  showFavicons: boolean;
  timestampDisplay: InboxTimestampDisplayDto;
  timestampHourCycle: "12h" | "24h";
  toolbar: ToolbarModel;
  hideInlineToolbar?: boolean;
}) {
  const { titleFontSizePx, titleLineHeightPx, sourceLabelFontSizePx } = getTypography({
    density,
    fontSizePx,
    readerFocusMode: false,
  });

  return (
    <div className="not-prose mb-6 flex flex-col gap-3">
      {hideInlineToolbar ? null : (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs uppercase tracking-wide text-muted-foreground">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Timestamp
              value={item.publishedAt}
              display={timestampDisplay}
              hourCycle={timestampHourCycle}
            />
            {readTime ? (
              <>
                <span>·</span>
                <span>{readTime} min read</span>
              </>
            ) : null}
          </div>
          <div ref={toolbar.inlineToolbarRef} className="hidden md:block">
            <Toolbar {...toolbar.toolbarProps} />
          </div>
        </div>
      )}
      <SourceRow
        articleUrl={item.link}
        feedId={item.feedId}
        feedFaviconUrl={item.feedFaviconUrl}
        feedUrl={item.feedUrl}
        feedSiteUrl={item.feedSiteUrl}
        feedTitle={item.feedTitle}
        showFavicon={showFavicons}
        className="min-w-0 flex-1 gap-3"
        iconClassName="size-5.5 rounded-sm"
        labelStyle={{ fontSize: `${sourceLabelFontSizePx}px` }}
        layoutId={`inbox-item-${item.id}-source`}
        sharedSourceLayoutId={getReaderSourceLayoutId(item)}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <m.p
          layoutId={`inbox-item-${item.id}-title`}
          className="min-w-0 flex-1 font-semibold tracking-[-0.012em] text-foreground"
          style={{
            fontSize: `${titleFontSizePx}px`,
            lineHeight: `${titleLineHeightPx}px`,
          }}
          transition={{ type: "spring", duration: 0.28, bounce: 0 }}
        >
          {item.title}
        </m.p>
      </div>
    </div>
  );
}

function ExtractionFailedBanner({ toolbar }: { toolbar: ToolbarModel }) {
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

export function Article({
  item,
  density,
  fontSizePx,
  showFavicons,
  timestampDisplay,
  timestampHourCycle,
  readerFocusMode = false,
  hideInlineToolbar = false,
}: {
  item: ArticleDetailDto;
  density: InboxDensityDto;
  fontSizePx: number;
  showFavicons: boolean;
  timestampDisplay: InboxTimestampDisplayDto;
  timestampHourCycle: "12h" | "24h";
  readerFocusMode?: boolean;
  hideInlineToolbar?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const toolbar = useReaderToolbar({ item, readerFocusMode });
  const articleRef = useRef<HTMLElement>(null);
  const floatingToolbarBounds = useFloatingToolbarBounds(
    articleRef,
    toolbar.floatingToolbarEdge === "top",
  );

  useTimestamp(timestampDisplay);
  const displayContent =
    toolbar.displayReader.contentHtml ??
    toolbar.displayReader.contentMarkdown ??
    toolbar.displayReader.contentText ??
    "";
  const readTime = displayContent ? estimateReadingTime(displayContent) : null;
  const shouldRenderArticleBody = !hideInlineToolbar || hasReaderArticleBody(toolbar.displayReader);

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
        density={density}
        fontSizePx={fontSizePx}
        showFavicons={showFavicons}
        timestampDisplay={timestampDisplay}
        timestampHourCycle={timestampHourCycle}
        toolbar={toolbar}
        hideInlineToolbar={hideInlineToolbar}
      />
      <ExtractionFailedBanner toolbar={toolbar} />

      <div className="relative" data-reader-inbox-body={hideInlineToolbar ? "" : undefined}>
        {shouldRenderArticleBody ? (
          <ReaderContent
            reader={toolbar.displayReader}
            openLinksInNewTab={toolbar.openLinksInNewTab}
            showLinkPreviews={toolbar.showLinkPreviews}
            layoutMode="fidelity"
          />
        ) : null}
      </div>
    </article>
  );
}
