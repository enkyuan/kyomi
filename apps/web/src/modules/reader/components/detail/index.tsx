/* oxlint-disable max-lines */
"use client";

import { Article } from "../article";
import { EmptyStateIcon } from "@kyomi/ui/icons/empty-state";
import { ScrollAreaPrimitive, ScrollBar } from "@kyomi/ui/scroll-area";
import { Skeleton } from "@kyomi/ui/skeleton";
import { getUserSafeErrorMessage } from "@lib/errors";
import type { ArticleDetailDto, InboxDensityDto, InboxTimestampDisplayDto } from "@lib/schemas";
import { Button } from "@kyomi/ui/button";
import { LeftFill } from "@mingcute/react";
import { cn } from "@lib/utils";
import { useReaderPreferences } from "@modules/reader/hooks/use-reader-preferences";
import { readerViewportContentInsetClass } from "@modules/reader/lib/detail-inset";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

const EMPTY_STATE_BODY_COPY =
  "Stories from your feeds appear here so you can preview them before opening the original source.";
const EMPTY_STATE_BODY_WIDTH = 440;
const DETAIL_BACK_BUTTON_BLUR_OFFSET = 52;
const DETAIL_BLUR_HEIGHT_PX = 64;
const DETAIL_BLUR_FEATHER_PX = 8;
const DETAIL_BLUR_OPACITY_STYLE = {
  opacity: "clamp(0, calc(var(--scroll-area-overflow-y-start) / 24px), 1)",
} as CSSProperties;
const DETAIL_BLUR_STRIPS = [
  { blur: "6px", start: 0, end: 18, opacity: 0.26 },
  { blur: "4.75px", start: 6, end: 24, opacity: 0.22 },
  { blur: "3.5px", start: 14, end: 32, opacity: 0.18 },
  { blur: "2.5px", start: 22, end: 40, opacity: 0.15 },
  { blur: "1.75px", start: 30, end: 48, opacity: 0.13 },
  { blur: "1.1px", start: 38, end: 56, opacity: 0.11 },
  { blur: "0.6px", start: 46, end: 64, opacity: 0.09 },
] as const;

type ArticleStepDirection = 1 | -1;

const ARTICLE_REEL_OFFSET = 56;

const articleReelVariants = {
  initial: (direction: ArticleStepDirection) => ({
    opacity: 0,
    y: direction * ARTICLE_REEL_OFFSET,
  }),
  animate: {
    opacity: 1,
    y: 0,
  },
  exit: (direction: ArticleStepDirection) => ({
    opacity: 0,
    y: direction * -ARTICLE_REEL_OFFSET,
  }),
};

function createDetailBlurMask(start: number, end: number): string {
  const clampedStart = Math.max(0, start);
  const clampedEnd = Math.min(DETAIL_BLUR_HEIGHT_PX, end);
  const featherStart = Math.max(clampedStart, clampedEnd - DETAIL_BLUR_FEATHER_PX);
  const featherEnd = Math.min(clampedEnd, clampedStart + DETAIL_BLUR_FEATHER_PX);

  return [
    "linear-gradient(to bottom,",
    `transparent 0px,`,
    `transparent ${clampedStart}px,`,
    `rgba(0, 0, 0, 0.88) ${featherEnd}px,`,
    `black ${featherStart}px,`,
    `transparent ${clampedEnd}px,`,
    `transparent ${DETAIL_BLUR_HEIGHT_PX}px)`,
  ].join(" ");
}

export type ReaderDetailState =
  | { status: "selected"; item: ArticleDetailDto }
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "empty" };

export type DetailHeaderState = {
  readerControlsCollapsed: boolean;
};

export interface DetailViewProps {
  detailState: ReaderDetailState;
  density: InboxDensityDto;
  fontSizePx: number;
  showFavicons: boolean;
  timestampDisplay: InboxTimestampDisplayDto;
  timestampHourCycle: "12h" | "24h";
  showBackToList?: boolean;
  onBackToList?: () => void;
  surface?: "card" | "inbox";
  header?: ReactNode | ((state: DetailHeaderState) => ReactNode);
  articleContentKey?: string;
  articleStepDirection?: ArticleStepDirection;
}

// oxlint-disable-next-line eslint/complexity
export function Detail({
  detailState,
  density,
  fontSizePx,
  showFavicons,
  timestampDisplay,
  timestampHourCycle,
  showBackToList = false,
  onBackToList,
  surface = "card",
  header,
  articleContentKey,
  articleStepDirection = 1,
}: DetailViewProps) {
  const { preferences } = useReaderPreferences();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const isInboxSurface = surface === "inbox";
  const isNarrowContent = preferences.contentWidth === "narrow";
  const blurTopOffset = showBackToList ? DETAIL_BACK_BUTTON_BLUR_OFFSET : 0;
  const selectedItem = detailState.status === "selected" ? detailState.item : null;
  const selectedItemId = selectedItem?.id;
  const [readerControlsState, setReaderControlsState] = useState({
    collapsed: false,
    selectedItemId,
  });
  let readerControlsCollapsed = readerControlsState.collapsed;

  if (readerControlsState.selectedItemId !== selectedItemId) {
    readerControlsCollapsed = false;
    setReaderControlsState({ collapsed: false, selectedItemId });
  }

  const selectedContentKey = articleContentKey ?? selectedItem?.id;
  const viewportContentInset =
    selectedItem &&
    (isInboxSurface
      ? "box-border w-full min-w-0 px-9.5"
      : readerViewportContentInsetClass({
          showBackToList,
          contentWidth: preferences.contentWidth,
        }));

  useEffect(() => {
    if (!selectedItemId) {
      return;
    }
    viewportRef.current?.scrollTo({ top: 0 });
  }, [selectedItemId]);

  useEffect(() => {
    if (!isInboxSurface || !selectedItemId) {
      return;
    }

    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    let previousScrollTop = viewport.scrollTop;
    let frameId: number | null = null;

    const updateCollapsedState = () => {
      frameId = null;
      const nextScrollTop = viewport.scrollTop;
      const delta = nextScrollTop - previousScrollTop;
      previousScrollTop = nextScrollTop;
      const nextCollapsed =
        nextScrollTop < 16 ? false : delta > 6 ? true : delta < -6 ? false : null;

      if (nextCollapsed === null) {
        return;
      }

      setReaderControlsState((current) =>
        current.selectedItemId === selectedItemId && current.collapsed === nextCollapsed
          ? current
          : { collapsed: nextCollapsed, selectedItemId },
      );
    };

    const handleScroll = () => {
      if (frameId !== null) {
        return;
      }
      frameId = window.requestAnimationFrame(updateCollapsedState);
    };

    viewport.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      viewport.removeEventListener("scroll", handleScroll);
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [isInboxSurface, selectedItemId]);

  const renderedHeader =
    typeof header === "function" ? header({ readerControlsCollapsed }) : header;

  return (
    <section
      className={cn(
        "flex h-full max-h-full min-h-80 min-w-0 flex-col overflow-hidden md:min-h-0",
        isInboxSurface
          ? "rounded-none border-0 bg-transparent text-foreground"
          : "rounded-2xl border border-border bg-card text-card-foreground shadow-sm/5 supports-[-webkit-touch-callout:none]:rounded-[1.75rem]",
      )}
    >
      <ScrollAreaPrimitive.Root className="relative min-h-0 flex-1 overflow-hidden">
        <ScrollAreaPrimitive.Viewport
          ref={viewportRef}
          className="h-full overflow-x-hidden outline-none scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden data-has-overflow-y:overscroll-y-contain scroll-mask-b-from-88%"
          data-reader-detail-viewport=""
          data-slot="scroll-area-viewport"
        >
          {renderedHeader}
          <div
            data-reader-detail-content=""
            className={cn(
              "min-w-0",
              viewportContentInset,
              detailState.status !== "selected" && "h-full",
              detailState.status === "selected" && !isNarrowContent && "min-h-full",
            )}
          >
            <DetailContent
              detailState={detailState}
              density={density}
              fontSizePx={fontSizePx}
              showFavicons={showFavicons}
              timestampDisplay={timestampDisplay}
              timestampHourCycle={timestampHourCycle}
              showBackToList={showBackToList}
              onBackToList={onBackToList}
              isInboxSurface={isInboxSurface}
              selectedContentKey={selectedContentKey}
              articleStepDirection={articleStepDirection}
            />
          </div>
        </ScrollAreaPrimitive.Viewport>
        {selectedItem && !isInboxSurface ? (
          <div
            className="pointer-events-none absolute inset-x-0 z-10 overflow-hidden"
            style={{
              ...DETAIL_BLUR_OPACITY_STYLE,
              height: `${DETAIL_BLUR_HEIGHT_PX}px`,
              top: `${blurTopOffset}px`,
            }}
          >
            {DETAIL_BLUR_STRIPS.map((strip) => (
              <div
                key={`${strip.blur}-${strip.start}-${strip.end}`}
                className="absolute inset-x-0 top-0 h-full"
                style={
                  {
                    opacity: strip.opacity,
                    WebkitMaskImage: createDetailBlurMask(strip.start, strip.end),
                    maskImage: createDetailBlurMask(strip.start, strip.end),
                    backdropFilter: `blur(${strip.blur})`,
                    WebkitBackdropFilter: `blur(${strip.blur})`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        ) : null}
        {selectedItem ? (
          <ScrollBar
            aria-label="Reader scrollbar"
            className={cn(
              "z-50",
              isInboxSurface &&
                "!fixed !top-0 !right-0 !bottom-0 !left-auto !h-auto !inset-inline-end-0",
            )}
            orientation="vertical"
          />
        ) : null}
      </ScrollAreaPrimitive.Root>
    </section>
  );
}

function DetailContent({
  detailState,
  density,
  fontSizePx,
  showFavicons,
  timestampDisplay,
  timestampHourCycle,
  showBackToList,
  onBackToList,
  isInboxSurface,
  selectedContentKey,
  articleStepDirection,
}: {
  detailState: ReaderDetailState;
  density: InboxDensityDto;
  fontSizePx: number;
  showFavicons: boolean;
  timestampDisplay: InboxTimestampDisplayDto;
  timestampHourCycle: "12h" | "24h";
  showBackToList: boolean;
  onBackToList?: () => void;
  isInboxSurface: boolean;
  selectedContentKey?: string;
  articleStepDirection: ArticleStepDirection;
}) {
  switch (detailState.status) {
    case "selected": {
      const content = (
        <SelectedArticleContent
          item={detailState.item}
          density={density}
          fontSizePx={fontSizePx}
          showFavicons={showFavicons}
          timestampDisplay={timestampDisplay}
          timestampHourCycle={timestampHourCycle}
          showBackToList={showBackToList}
          onBackToList={onBackToList}
          isInboxSurface={isInboxSurface}
        />
      );

      return selectedContentKey ? (
        <AnimatedArticleContent
          contentKey={selectedContentKey}
          articleStepDirection={articleStepDirection}
        >
          {content}
        </AnimatedArticleContent>
      ) : (
        content
      );
    }
    case "loading":
      return <LoadingDetailContent />;
    case "error":
      return <ErrorDetailContent error={detailState.error} />;
    case "empty":
      return <EmptyDetailContent />;
  }
}

function SelectedArticleContent({
  item,
  density,
  fontSizePx,
  showFavicons,
  timestampDisplay,
  timestampHourCycle,
  showBackToList,
  onBackToList,
  isInboxSurface,
}: {
  item: ArticleDetailDto;
  density: InboxDensityDto;
  fontSizePx: number;
  showFavicons: boolean;
  timestampDisplay: InboxTimestampDisplayDto;
  timestampHourCycle: "12h" | "24h";
  showBackToList: boolean;
  onBackToList?: () => void;
  isInboxSurface: boolean;
}) {
  return (
    <>
      {showBackToList ? (
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="mb-3 max-md:aspect-square max-md:px-0 md:h-8 md:gap-2 md:px-[calc(--spacing(2.5)-1px)]"
          onClick={onBackToList}
          aria-label="Back to feed"
        >
          <LeftFill className="size-4" />
          <span className="hidden md:inline">Back to feed</span>
        </Button>
      ) : null}
      <Article
        item={item}
        density={density}
        fontSizePx={fontSizePx}
        showFavicons={showFavicons}
        timestampDisplay={timestampDisplay}
        timestampHourCycle={timestampHourCycle}
        readerFocusMode={showBackToList || isInboxSurface}
        hideInlineToolbar={isInboxSurface}
      />
    </>
  );
}

function AnimatedArticleContent({
  contentKey,
  articleStepDirection,
  children,
}: {
  contentKey: string;
  articleStepDirection: ArticleStepDirection;
  children: ReactNode;
}) {
  const prefersReducedMotion = useReducedMotion();
  const articleReelTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.3, bounce: 0 };

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence initial={false} mode="popLayout" custom={articleStepDirection}>
        <m.div
          key={contentKey}
          custom={articleStepDirection}
          className="min-w-0"
          variants={articleReelVariants}
          initial={prefersReducedMotion ? false : "initial"}
          animate="animate"
          exit={prefersReducedMotion ? undefined : "exit"}
          transition={articleReelTransition}
        >
          {children}
        </m.div>
      </AnimatePresence>
    </LazyMotion>
  );
}

function LoadingDetailContent() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 p-12">
      <div className="space-y-3">
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="h-6 w-3/4 rounded" />
        <Skeleton className="h-6 w-1/2 rounded" />
        <Skeleton className="h-4 w-32 rounded" />
      </div>
      <div className="space-y-2.5">
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-[94%] rounded" />
        <Skeleton className="h-4 w-[88%] rounded" />
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-[91%] rounded" />
        <Skeleton className="h-4 w-[85%] rounded" />
      </div>
      <div className="space-y-2.5">
        <Skeleton className="h-4 w-[96%] rounded" />
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-[90%] rounded" />
      </div>
    </div>
  );
}

function ErrorDetailContent({ error }: { error: unknown }) {
  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <p className="text-base font-semibold text-foreground">Couldn't load article</p>
      <p className="text-sm text-muted-foreground">
        {getUserSafeErrorMessage(error, "There was a problem loading this item.")}
      </p>
    </div>
  );
}

function EmptyDetailContent() {
  return (
    <div className="flex h-full min-h-72 w-full flex-col items-center justify-center gap-5 px-6 py-10 text-center">
      <EmptyStateIcon className="size-40 shrink-0 sm:size-44" size={176} />
      <div className="w-full max-w-136 space-y-2">
        <p className="text-base font-semibold text-foreground">Select an item to start reading</p>
        <BalancedEmptyStateBody text={EMPTY_STATE_BODY_COPY} />
      </div>
    </div>
  );
}

function BalancedEmptyStateBody({ text }: { text: string }) {
  return (
    <p
      className="mx-auto text-sm leading-6 text-muted-foreground"
      style={{ maxWidth: `${EMPTY_STATE_BODY_WIDTH}px`, textWrap: "balance" }}
    >
      {text}
    </p>
  );
}
