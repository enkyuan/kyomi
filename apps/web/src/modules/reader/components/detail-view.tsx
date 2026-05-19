"use client";

import { ReaderArticleDetail } from "./article-detail";
import { EmptyStateIcon } from "@components/icons/empty-state-svg";
import { ScrollAreaPrimitive, ScrollBar } from "@components/ui/scroll-area";
import { Skeleton } from "@components/ui/skeleton";
import type { ArticleDetailDto, InboxTimestampDisplayDto } from "@lib/api-schemas";
import { Button } from "@components/ui/button";
import { LeftFill } from "@mingcute/react";
import { cn } from "@lib/utils";
import type { CSSProperties } from "react";

const EMPTY_STATE_BODY_COPY =
  "Stories from your feeds appear here so you can preview them before opening the original source.";
const EMPTY_STATE_BODY_WIDTH = 440;
const DETAIL_BACK_BUTTON_BLUR_OFFSET = 52;
const DETAIL_BLUR_HEIGHT_PX = 64;
const DETAIL_BLUR_FEATHER_PX = 8;
const DETAIL_BLUR_OPACITY_STYLE = {
  opacity: "clamp(0, calc(var(--scroll-area-overflow-y-start) / 24px), 1)",
} as CSSProperties;
/** Full inset for reader-focus; split view keeps top clear so the floating toolbar stays tight. */
const DETAIL_VIEWPORT_PADDING_READER_FOCUS = "p-3 md:p-8";
const DETAIL_VIEWPORT_PADDING_SPLIT = "px-3 pb-3 pt-0 md:px-8 md:pb-8";
const DETAIL_SCROLLBAR_INSET_CLASS =
  "absolute inset-y-0 z-50 m-0 w-1.5 end-3 md:end-8 opacity-0 transition-opacity delay-300 data-hovering:opacity-100 data-scrolling:opacity-100 data-hovering:delay-0 data-scrolling:delay-0 data-hovering:duration-100 data-scrolling:duration-100";

const DETAIL_BLUR_STRIPS = [
  { blur: "6px", start: 0, end: 18, opacity: 0.26 },
  { blur: "4.75px", start: 6, end: 24, opacity: 0.22 },
  { blur: "3.5px", start: 14, end: 32, opacity: 0.18 },
  { blur: "2.5px", start: 22, end: 40, opacity: 0.15 },
  { blur: "1.75px", start: 30, end: 48, opacity: 0.13 },
  { blur: "1.1px", start: 38, end: 56, opacity: 0.11 },
  { blur: "0.6px", start: 46, end: 64, opacity: 0.09 },
] as const;

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

export interface ReaderDetailViewProps {
  detailState: ReaderDetailState;
  showFavicons: boolean;
  timestampDisplay: InboxTimestampDisplayDto;
  timestampHourCycle: "12h" | "24h";
  showBackToList?: boolean;
  onBackToList?: () => void;
}

export function ReaderDetailView({
  detailState,
  showFavicons,
  timestampDisplay,
  timestampHourCycle,
  showBackToList = false,
  onBackToList,
}: ReaderDetailViewProps) {
  const blurTopOffset = showBackToList ? DETAIL_BACK_BUTTON_BLUR_OFFSET : 0;
  const selectedItem = detailState.status === "selected" ? detailState.item : null;

  return (
    <section className="flex h-full max-h-full min-h-80 min-w-0 flex-col overflow-hidden rounded-2xl supports-[-webkit-touch-callout:none]:rounded-[1.75rem] border border-border bg-card text-card-foreground md:min-h-0">
      <ScrollAreaPrimitive.Root className="relative min-h-0 flex-1 overflow-hidden">
        <ScrollAreaPrimitive.Viewport
          className={cn(
            "h-full overflow-x-hidden outline-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden data-has-overflow-y:overscroll-y-contain mask-t-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-start)))] mask-b-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-end)))] mask-l-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-start)))] mask-r-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-end)))] [--fade-size:1rem]",
            selectedItem &&
              (showBackToList
                ? DETAIL_VIEWPORT_PADDING_READER_FOCUS
                : DETAIL_VIEWPORT_PADDING_SPLIT),
          )}
          data-reader-detail-viewport=""
          data-slot="scroll-area-viewport"
        >
          {detailState.status === "selected" ? (
            <div className="min-h-full min-w-0">
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
              <ReaderArticleDetail
                item={detailState.item}
                showFavicons={showFavicons}
                timestampDisplay={timestampDisplay}
                timestampHourCycle={timestampHourCycle}
                readerFocusMode={false}
              />
            </div>
          ) : detailState.status === "loading" ? (
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
          ) : detailState.status === "error" ? (
            <div className="flex h-full min-h-72 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
              <p className="text-base font-semibold text-foreground">Couldn't load article</p>
              <p className="text-sm text-muted-foreground">
                {detailState.error instanceof Error
                  ? detailState.error.message
                  : "There was a problem loading this item."}
              </p>
            </div>
          ) : (
            <div className="flex w-full h-full min-h-72 flex-col items-center justify-center gap-5 px-6 py-10 text-center">
              <EmptyStateIcon className="size-40 shrink-0 sm:size-44" height={176} width={176} />
              <div className="w-full max-w-136 space-y-2">
                <p className="text-base font-semibold text-foreground">
                  Select an item to start reading
                </p>
                <BalancedEmptyStateBody text={EMPTY_STATE_BODY_COPY} />
              </div>
            </div>
          )}
        </ScrollAreaPrimitive.Viewport>
        {selectedItem ? (
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
        <ScrollBar className={DETAIL_SCROLLBAR_INSET_CLASS} orientation="vertical" />
      </ScrollAreaPrimitive.Root>
    </section>
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
