"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, type FocusEvent, type PointerEvent, type RefObject } from "react";
import { Skeleton } from "@vols.rss/ui/skeleton";
import type { InboxDensityDto, InboxTimestampDisplayDto } from "@lib/schemas";
import { Item } from "@modules/feeds/components/item";
import type { InboxFilter, InboxItem } from "@modules/inbox/services/api";
import {
  DEFAULT_SKELETON_ROWS,
  getFeedItemRowEstimate,
  MAX_SKELETON_ROWS,
  MIN_SKELETON_ROWS,
  SKELETON_OVERSCAN_ROWS,
} from "@modules/inbox/lib/list-layout";

export type RowsPaginationState = {
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
};

export function SkeletonRows({
  density,
  showFavicons,
  readerFocusMode = false,
  viewportHeight,
}: {
  density: InboxDensityDto;
  showFavicons: boolean;
  readerFocusMode?: boolean;
  viewportHeight?: number;
}) {
  const isCompact = density === "compact";
  const summaryLineCount = readerFocusMode ? (isCompact ? 4 : 5) : isCompact ? 2 : 3;
  const estimatedRowHeight = getFeedItemRowEstimate({ density, readerFocusMode });
  const fallbackViewportHeight =
    viewportHeight && viewportHeight > 0
      ? viewportHeight
      : typeof window !== "undefined"
        ? window.innerHeight
        : 0;
  const skeletonRowCount =
    fallbackViewportHeight > 0
      ? Math.max(
          MIN_SKELETON_ROWS,
          Math.min(
            MAX_SKELETON_ROWS,
            Math.ceil(fallbackViewportHeight / estimatedRowHeight) + SKELETON_OVERSCAN_ROWS,
          ),
        )
      : DEFAULT_SKELETON_ROWS;
  return (
    <ul className="w-full">
      {Array.from({ length: skeletonRowCount }).map((_, index) => (
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

export function StaticRows({
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
  onToolbarEnter,
  onToolbarLeave,
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
  onToolbarEnter: (item: InboxItem, anchorElement: HTMLElement) => void;
  onToolbarLeave: (event: FocusEvent<HTMLElement> | PointerEvent<HTMLElement>) => void;
}) {
  return (
    <div className="relative w-full pb-4">
      {inboxItems.map((item, index) => (
        <div key={item.id} className="group/inbox-row relative w-full">
          <Item
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
            onToolbarEnter={onToolbarEnter}
            onToolbarLeave={onToolbarLeave}
          />
        </div>
      ))}
    </div>
  );
}
export function VirtualizedRows({
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
  pagination,
  onSelectItem,
  onToolbarEnter,
  onToolbarLeave,
  viewportHeight,
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
  pagination: RowsPaginationState;
  onSelectItem: (item: InboxItem) => void;
  onToolbarEnter: (item: InboxItem, anchorElement: HTMLElement) => void;
  onToolbarLeave: (event: FocusEvent<HTMLElement> | PointerEvent<HTMLElement>) => void;
  viewportHeight?: number;
}) {
  const { isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = pagination;
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
    return (
      <SkeletonRows
        density={density}
        showFavicons={showFavicons}
        readerFocusMode={readerFocusMode}
        viewportHeight={viewportHeight}
      />
    );
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
            <Item
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
              onToolbarEnter={onToolbarEnter}
              onToolbarLeave={onToolbarLeave}
            />
          </div>
        );
      })}
    </div>
  );
}
