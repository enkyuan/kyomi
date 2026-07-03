"use client";

import { BrowserScrollBar, ScrollAreaPrimitive, ScrollBar } from "@kyomi/ui/scroll-area";
import type {
  ArticleDetailDto,
  InboxDensityDto,
  InboxTimestampDisplayDto,
} from "@lib/schemas/index";
import { cn } from "@kyomi/ui/lib/utils";
import { useReaderPreferences } from "@modules/reader/hooks/preferences";
import { readerViewportContentInsetClass } from "@modules/reader/lib/detail-inset";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { BlurLayer } from "./blur-layer";
import { ContentView } from "./content-view";

const DETAIL_BACK_BUTTON_BLUR_OFFSET = 52;

type ArticleStepDirection = 1 | -1;
type DetailSurface = "browser" | "card";

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
  surface?: DetailSurface;
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
  surface = "browser",
  header,
  articleContentKey,
  articleStepDirection = 1,
}: DetailViewProps) {
  const { preferences } = useReaderPreferences();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const isBrowserSurface = surface === "browser";
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
    (isBrowserSurface
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
    if (!isBrowserSurface || !selectedItemId) {
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
  }, [isBrowserSurface, selectedItemId]);

  const renderedHeader =
    typeof header === "function" ? header({ readerControlsCollapsed }) : header;

  return (
    <section
      className={cn(
        "flex h-full max-h-full min-h-80 min-w-0 flex-col overflow-hidden md:min-h-0",
        isBrowserSurface
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
            <ContentView
              detailState={detailState}
              density={density}
              fontSizePx={fontSizePx}
              showFavicons={showFavicons}
              timestampDisplay={timestampDisplay}
              timestampHourCycle={timestampHourCycle}
              showBackToList={showBackToList}
              onBackToList={onBackToList}
              isBrowserSurface={isBrowserSurface}
              selectedContentKey={selectedContentKey}
              articleStepDirection={articleStepDirection}
            />
          </div>
        </ScrollAreaPrimitive.Viewport>
        {selectedItem && !isBrowserSurface ? <BlurLayer topOffset={blurTopOffset} /> : null}
        {selectedItem && isBrowserSurface ? (
          <BrowserScrollBar
            aria-label="Reader scrollbar"
            className="z-50 !fixed !top-0 !right-0 !bottom-0 !left-auto !h-auto !inset-inline-end-0"
            orientation="vertical"
          />
        ) : selectedItem ? (
          <ScrollBar aria-label="Reader scrollbar" className="z-50" orientation="vertical" />
        ) : null}
      </ScrollAreaPrimitive.Root>
    </section>
  );
}
