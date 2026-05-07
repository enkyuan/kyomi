"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useViewportMetrics } from "@hooks/use-viewport-metrics";
import { FeedItem } from "@modules/inbox/components/item";
import { InboxListFilterMenu } from "@modules/inbox/components/list-filter-menu";
import {
  FeedRefreshStatus,
  FeedRefreshSummary,
  BatchFeedRefreshStatus,
} from "@modules/inbox/components/refresh-status";
import { ScrollAreaPrimitive, ScrollBar } from "@components/ui/scroll-area";
import { Skeleton } from "@components/ui/skeleton";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { InboxFilter, InboxItem } from "@modules/inbox/api";
import type { InboxDensityDto, InboxTimestampDisplayDto } from "@lib/api-schemas";
import type { InboxListHeaderCount } from "@modules/inbox/lib/count-display";

const FEED_ITEM_ROW_ESTIMATE = {
  comfortable: 232,
  compact: 180,
  comfortableReaderFocus: 248,
  compactReaderFocus: 196,
} as const;

function getFeedItemRowEstimate({
  density,
  readerFocusMode,
}: {
  density: InboxDensityDto;
  readerFocusMode: boolean;
}) {
  return FEED_ITEM_ROW_ESTIMATE[
    readerFocusMode
      ? density === "compact"
        ? "compactReaderFocus"
        : "comfortableReaderFocus"
      : density
  ];
}

interface InboxListProps {
  inboxItems: InboxItem[];
  headerCount: InboxListHeaderCount;
  filter: InboxFilter;
  readerFocusMode?: boolean;
  disableVirtualization?: boolean;
  density: InboxDensityDto;
  fontSizePx: number;
  showFavicons: boolean;
  timestampDisplay: InboxTimestampDisplayDto;
  timestampHourCycle: "12h" | "24h";
  selectedItemId?: string | null;
  feedId?: string | null;
  folderId?: string | null;
  showHidden?: boolean;
  showRead?: boolean;
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  onSelectItem: (item: InboxItem) => void;
}

function InboxListSkeletonRows({
  density,
  showFavicons,
  readerFocusMode = false,
}: {
  density: InboxDensityDto;
  showFavicons: boolean;
  readerFocusMode?: boolean;
}) {
  const isCompact = density === "compact";
  const summaryLineCount = readerFocusMode ? (isCompact ? 4 : 5) : isCompact ? 2 : 3;
  return (
    <ul className="w-full">
      {Array.from({ length: 6 }).map((_, index) => (
        <li
          key={`skeleton-${index}`}
          className={`w-full border-x-0 border-border/70 bg-transparent${index === 0 ? "" : " border-t"}`}
        >
          <div
            className={
              isCompact ? "flex flex-col gap-1.5 px-5 py-2.5" : "flex flex-col gap-2 px-5 py-3"
            }
          >
            <div className="flex items-center gap-2">
              {showFavicons ? <Skeleton className="size-4.5 shrink-0 rounded-[3px]" /> : null}
              <Skeleton className="h-3 w-24 rounded" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4.5 w-full rounded" />
              <Skeleton className="h-4.5 w-3/4 rounded" />
            </div>
          </div>
          <div className="space-y-1.5 px-5">
            <Skeleton className="h-3.5 w-full rounded" />
            <Skeleton className="h-3.5 w-full rounded" />
            {Array.from({ length: Math.max(0, summaryLineCount - 2) }).map((_, index) => (
              <Skeleton
                key={`summary-line-${index}`}
                className={`h-3.5 rounded ${index === summaryLineCount - 3 ? "w-4/5" : "w-full"}`}
              />
            ))}
          </div>
          <div
            className={
              readerFocusMode
                ? isCompact
                  ? "mt-2 px-5 pb-3"
                  : "mt-2.5 px-5 pb-3.5"
                : isCompact
                  ? "mt-1.5 px-5 pb-2.5"
                  : "mt-2 px-5 pb-3"
            }
          >
            <Skeleton className="h-3 w-28 rounded" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function InboxListStatic({
  filter,
  readerFocusMode,
  density,
  fontSizePx,
  showFavicons,
  listContainerWidth,
  timestampDisplay,
  timestampHourCycle,
  inboxItems,
  selectedItemId,
  onSelectItem,
}: {
  filter: InboxFilter;
  readerFocusMode: boolean;
  density: InboxDensityDto;
  fontSizePx: number;
  showFavicons: boolean;
  listContainerWidth?: number;
  timestampDisplay: InboxTimestampDisplayDto;
  timestampHourCycle: "12h" | "24h";
  inboxItems: InboxItem[];
  selectedItemId?: string | null;
  onSelectItem: (item: InboxItem) => void;
}) {
  return (
    <div className="relative w-full pb-4">
      {inboxItems.map((item, index) => (
        <div key={item.id} className="group/inbox-row relative w-full">
          <FeedItem
            filter={filter}
            item={item}
            isSelected={selectedItemId === item.id}
            isFirst={index === 0}
            containerWidth={listContainerWidth || undefined}
            readerFocusMode={readerFocusMode}
            showBottomSeparator={index === inboxItems.length - 1}
            density={density}
            fontSizePx={fontSizePx}
            showFavicons={showFavicons}
            timestampDisplay={timestampDisplay}
            timestampHourCycle={timestampHourCycle}
            onSelect={onSelectItem}
          />
        </div>
      ))}
    </div>
  );
}

function InboxListVirtualized({
  listScrollRef,
  filter,
  readerFocusMode,
  density,
  fontSizePx,
  showFavicons,
  listContainerWidth,
  timestampDisplay,
  timestampHourCycle,
  inboxItems,
  selectedItemId,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onSelectItem,
}: {
  listScrollRef: RefObject<HTMLDivElement | null>;
  filter: InboxFilter;
  readerFocusMode: boolean;
  density: InboxDensityDto;
  fontSizePx: number;
  showFavicons: boolean;
  listContainerWidth?: number;
  timestampDisplay: InboxTimestampDisplayDto;
  timestampHourCycle: "12h" | "24h";
  inboxItems: InboxItem[];
  selectedItemId?: string | null;
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  onSelectItem: (item: InboxItem) => void;
}) {
  const virtualizer = useVirtualizer({
    count: inboxItems.length,
    getItemKey: (index) => inboxItems[index]?.id ?? index,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => getFeedItemRowEstimate({ density, readerFocusMode }),
    overscan: 6,
    useAnimationFrameWithResizeObserver: true,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastVirtualItem = virtualItems[virtualItems.length - 1];

  useEffect(() => {
    if (
      lastVirtualItem &&
      lastVirtualItem.index >= inboxItems.length - 10 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [lastVirtualItem?.index, inboxItems.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const listContentHeight = virtualizer.getTotalSize();

  if (isLoading && inboxItems.length === 0) {
    return <InboxListSkeletonRows density={density} showFavicons={showFavicons} />;
  }

  if (inboxItems.length === 0) {
    return null;
  }

  return (
    <div
      className="relative w-full pb-4"
      style={{
        height: `${listContentHeight}px`,
      }}
    >
      {virtualItems.map((virtualRow) => {
        const item = inboxItems[virtualRow.index];
        if (!item) {
          return null;
        }
        return (
          <div
            key={virtualRow.key}
            ref={virtualizer.measureElement}
            className="group/inbox-row absolute left-0 top-0 w-full"
            data-index={virtualRow.index}
            style={{
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <FeedItem
              filter={filter}
              item={item}
              isSelected={selectedItemId === item.id}
              isFirst={virtualRow.index === 0}
              containerWidth={listContainerWidth || undefined}
              readerFocusMode={readerFocusMode}
              showBottomSeparator={virtualRow.index === inboxItems.length - 1}
              density={density}
              fontSizePx={fontSizePx}
              showFavicons={showFavicons}
              timestampDisplay={timestampDisplay}
              timestampHourCycle={timestampHourCycle}
              onSelect={onSelectItem}
            />
          </div>
        );
      })}
    </div>
  );
}

export function InboxList({
  inboxItems,
  headerCount,
  filter,
  readerFocusMode = false,
  disableVirtualization = false,
  density,
  fontSizePx,
  showFavicons,
  timestampDisplay,
  timestampHourCycle,
  selectedItemId,
  feedId,
  folderId,
  showHidden = false,
  showRead = false,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onSelectItem,
}: InboxListProps) {
  const [isVirtualizerHostMounted, setIsVirtualizerHostMounted] = useState(false);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const { containerWidth: listContainerWidth } = useViewportMetrics(listScrollRef, [
    inboxItems.length,
    isLoading,
    density,
    fontSizePx,
    readerFocusMode,
  ]);
  const shouldUseStaticList = disableVirtualization && inboxItems.length <= 250;

  useEffect(() => {
    setIsVirtualizerHostMounted(true);
  }, []);

  return (
    <section className="relative flex h-full max-h-full min-h-80 min-w-0 flex-col overflow-hidden rounded-2xl supports-[-webkit-touch-callout:none]:rounded-[1.75rem] border border-border bg-card text-card-foreground [--inbox-header-height:3rem] md:min-h-0">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-(--inbox-header-height) border-b border-border bg-card">
        <div className="pointer-events-auto flex h-full items-center justify-between gap-3 pl-2.5 pr-2">
          <span className="inline-flex items-center whitespace-nowrap ps-1.5 font-medium text-muted-foreground text-sm tabular-nums">
            {headerCount.numberPart} {headerCount.unitPart}
            {feedId ? <FeedRefreshSummary feedId={feedId} /> : null}
          </span>
          <div className="flex items-center gap-0.5">
            {feedId ? (
              <FeedRefreshStatus feedId={feedId} />
            ) : (
              <BatchFeedRefreshStatus folderId={folderId ?? undefined} />
            )}
            <InboxListFilterMenu filter={filter} showHidden={showHidden} showRead={showRead} />
          </div>
        </div>
      </div>
      <ScrollAreaPrimitive.Root className="min-h-0 flex-1 overflow-hidden">
        <ScrollAreaPrimitive.Viewport
          ref={listScrollRef}
          className="h-full overflow-x-hidden outline-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden data-has-overflow-y:overscroll-y-contain"
          data-slot="inbox-list-viewport"
        >
          <div className="pt-(--inbox-header-height)">
            {!isVirtualizerHostMounted ? (
              isLoading && inboxItems.length === 0 ? (
                <InboxListSkeletonRows density={density} showFavicons={showFavicons} />
              ) : inboxItems.length === 0 ? null : (
                <InboxListSkeletonRows
                  density={density}
                  showFavicons={showFavicons}
                  readerFocusMode={readerFocusMode}
                />
              )
            ) : shouldUseStaticList ? (
              <InboxListStatic
                filter={filter}
                readerFocusMode={readerFocusMode}
                density={density}
                fontSizePx={fontSizePx}
                showFavicons={showFavicons}
                listContainerWidth={listContainerWidth}
                timestampDisplay={timestampDisplay}
                timestampHourCycle={timestampHourCycle}
                inboxItems={inboxItems}
                selectedItemId={selectedItemId}
                onSelectItem={onSelectItem}
              />
            ) : (
              <InboxListVirtualized
                listScrollRef={listScrollRef}
                filter={filter}
                readerFocusMode={readerFocusMode}
                density={density}
                fontSizePx={fontSizePx}
                showFavicons={showFavicons}
                listContainerWidth={listContainerWidth}
                timestampDisplay={timestampDisplay}
                timestampHourCycle={timestampHourCycle}
                inboxItems={inboxItems}
                selectedItemId={selectedItemId}
                isLoading={isLoading}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                fetchNextPage={fetchNextPage}
                onSelectItem={onSelectItem}
              />
            )}
          </div>
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar
          className="z-50 mt-(--inbox-header-height) h-[calc(100%-var(--inbox-header-height))]"
          orientation="vertical"
        />
      </ScrollAreaPrimitive.Root>
    </section>
  );
}
