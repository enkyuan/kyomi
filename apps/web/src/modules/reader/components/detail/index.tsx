"use client";

import { Article } from "../article";
import { EmptyStateIcon } from "@kyomi/ui/icons/empty-state";
import { ScrollAreaPrimitive, ScrollBar } from "@kyomi/ui/scroll-area";
import { Skeleton } from "@kyomi/ui/skeleton";
import { getUserSafeErrorMessage } from "@lib/errors";
import type { ArticleDetailDto, InboxTimestampDisplayDto } from "@lib/schemas";
import { Button } from "@kyomi/ui/button";
import { LeftFill } from "@mingcute/react";
import { cn } from "@lib/utils";
import { useReaderPreferences } from "@modules/reader/hooks/use-reader-preferences";
import { readerViewportContentInsetClass } from "@modules/reader/lib/detail-inset";
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

export interface DetailViewProps {
  detailState: ReaderDetailState;
  showFavicons: boolean;
  timestampDisplay: InboxTimestampDisplayDto;
  timestampHourCycle: "12h" | "24h";
  showBackToList?: boolean;
  onBackToList?: () => void;
}

export function Detail({
  detailState,
  showFavicons,
  timestampDisplay,
  timestampHourCycle,
  showBackToList = false,
  onBackToList,
}: DetailViewProps) {
  const { preferences } = useReaderPreferences();
  const isNarrowContent = preferences.contentWidth === "narrow";
  const blurTopOffset = showBackToList ? DETAIL_BACK_BUTTON_BLUR_OFFSET : 0;
  const selectedItem = detailState.status === "selected" ? detailState.item : null;
  const viewportContentInset =
    selectedItem &&
    readerViewportContentInsetClass({
      showBackToList,
      contentWidth: preferences.contentWidth,
    });
  return (
    <section className="flex h-full max-h-full min-h-80 min-w-0 flex-col overflow-hidden rounded-2xl supports-[-webkit-touch-callout:none]:rounded-[1.75rem] border border-border bg-card text-card-foreground md:min-h-0">
      <ScrollAreaPrimitive.Root className="relative min-h-0 flex-1 overflow-hidden">
        <ScrollAreaPrimitive.Viewport
          className="h-full overflow-x-hidden outline-none scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden data-has-overflow-y:overscroll-y-contain scroll-mask-b-from-88%"
          data-reader-detail-viewport=""
          data-slot="scroll-area-viewport"
        >
          <div
            data-reader-detail-content=""
            className={cn(
              "min-w-0",
              viewportContentInset,
              detailState.status !== "selected" && "h-full",
              detailState.status === "selected" && !isNarrowContent && "min-h-full",
            )}
          >
            {detailState.status === "selected" ? (
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
                  item={detailState.item}
                  showFavicons={showFavicons}
                  timestampDisplay={timestampDisplay}
                  timestampHourCycle={timestampHourCycle}
                  readerFocusMode={showBackToList}
                />
              </>
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
                  {getUserSafeErrorMessage(
                    detailState.error,
                    "There was a problem loading this item.",
                  )}
                </p>
              </div>
            ) : (
              <div className="flex h-full min-h-72 w-full flex-col items-center justify-center gap-5 px-6 py-10 text-center">
                <EmptyStateIcon className="size-40 shrink-0 sm:size-44" height={176} width={176} />
                <div className="w-full max-w-136 space-y-2">
                  <p className="text-base font-semibold text-foreground">
                    Select an item to start reading
                  </p>
                  <BalancedEmptyStateBody text={EMPTY_STATE_BODY_COPY} />
                </div>
              </div>
            )}
          </div>
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
        {selectedItem ? <ScrollBar className="z-50" orientation="vertical" /> : null}
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
