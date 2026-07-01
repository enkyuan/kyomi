"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import type { RefObject } from "react";
import type { InboxDensityDto, InboxTimestampDisplayDto } from "@lib/schemas";
import { Item } from "@modules/feeds/components/item";
import type { InboxFilter, InboxItem } from "@modules/inbox/services/api";
import { Skeleton } from "@kyomi/ui/skeleton";
import {
  DEFAULT_SKELETON_ROWS,
  getFeedItemRowEstimate,
  MAX_SKELETON_ROWS,
  MIN_SKELETON_ROWS,
  SKELETON_OVERSCAN_ROWS,
} from "@modules/inbox/lib/layout";

const SKELETON_ROW_GUTTER_CLASS = "px-10.5";
const SKELETON_ROW_SEPARATOR_CLASS = "left-10.5 right-10.5";

export type RowsPaginationState = {
  isLoading: boolean;
  isRefreshing: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  dataUpdatedAt?: number;
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
  const skeletonRowCount =
    viewportHeight && viewportHeight > 0
      ? Math.max(
          MIN_SKELETON_ROWS,
          Math.min(
            MAX_SKELETON_ROWS,
            Math.ceil(viewportHeight / estimatedRowHeight) + SKELETON_OVERSCAN_ROWS,
          ),
        )
      : DEFAULT_SKELETON_ROWS;
  return (
    <ul className="w-full">
      {Array.from({ length: skeletonRowCount }).map((_, index) => (
        <li key={`skeleton-${index}`} className="relative w-full bg-transparent">
          {index === 0 ? null : (
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute top-0 h-px bg-border/70 ${SKELETON_ROW_SEPARATOR_CLASS}`}
            />
          )}
          <div
            className={
              isCompact
                ? `flex flex-col gap-3.5 pt-4 pb-2 ${SKELETON_ROW_GUTTER_CLASS}`
                : `flex flex-col gap-4 pt-5 pb-2.5 ${SKELETON_ROW_GUTTER_CLASS}`
            }
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {showFavicons ? <Skeleton className="size-5.5 shrink-0 rounded-sm" /> : null}
                <Skeleton className="h-3.5 w-28 rounded" />
              </div>
              <Skeleton className="h-3.5 w-20 shrink-0 rounded" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-full rounded" />
              <Skeleton className="h-5 w-[70%] rounded" />
            </div>
          </div>
          <div className={`space-y-1.5 ${SKELETON_ROW_GUTTER_CLASS}`}>
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-full rounded" />
            {Array.from({ length: Math.max(0, summaryLineCount - 2) }).map((_, index) => (
              <Skeleton
                key={`summary-line-${index}`}
                className={`h-4 rounded ${index === summaryLineCount - 3 ? "w-4/5" : "w-full"}`}
              />
            ))}
          </div>
          <div className={isCompact ? "pb-3" : "pb-4"} />
        </li>
      ))}
    </ul>
  );
}

export type StaticRowsProps = {
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
};

// oxlint-disable-next-line react-doctor/no-multi-comp
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
}: StaticRowsProps) {
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
            showBottomSeparator={false}
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

export type VirtualizedRowsProps = {
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
  viewportHeight?: number;
};

// oxlint-disable-next-line react-doctor/no-multi-comp
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
  viewportHeight,
}: VirtualizedRowsProps) {
  const { isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = pagination;
  const virtualizer = useVirtualizer({
    count: inboxItems.length,
    getItemKey: (index) => inboxItems[index]?.id ?? index,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => getFeedItemRowEstimate({ density, readerFocusMode }),
    overscan: 6,
    useAnimationFrameWithResizeObserver: true,
    onChange: (nextVirtualizer) => {
      const nextVirtualItems = nextVirtualizer.getVirtualItems();
      const nextLastVirtualItem = nextVirtualItems[nextVirtualItems.length - 1];
      if (
        nextLastVirtualItem &&
        nextLastVirtualItem.index >= inboxItems.length - 10 &&
        hasNextPage &&
        !isFetchingNextPage
      ) {
        fetchNextPage();
      }
    },
  });

  const virtualItems = virtualizer.getVirtualItems();
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
              showBottomSeparator={false}
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
