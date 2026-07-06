"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { type RefObject, useLayoutEffect, useRef } from "react";
import type { InboxDensityDto, InboxTimestampDisplayDto } from "@lib/schemas/index";
import { Item } from "@modules/feeds/components/item";
import type { InboxFilter, InboxItem } from "@modules/inbox/lib/articles/index";
import { Skeleton } from "@kyomi/ui/skeleton";
import { getSectionClassNames, getTypography } from "@modules/feeds/lib/layout";
import {
  DEFAULT_SKELETON_ROWS,
  getFeedItemRowEstimate,
  MAX_SKELETON_ROWS,
  MIN_SKELETON_ROWS,
  SKELETON_OVERSCAN_ROWS,
} from "@modules/inbox/lib/layout/index";

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
  fontSizePx,
  showFavicons,
  readerFocusMode = false,
  viewportHeight,
}: {
  density: InboxDensityDto;
  fontSizePx: number;
  showFavicons: boolean;
  readerFocusMode?: boolean;
  viewportHeight?: number;
}) {
  const typography = getTypography({ density, fontSizePx, readerFocusMode });
  const sectionClassNames = getSectionClassNames({
    readerFocusMode,
    isCompact: typography.isCompact,
  });
  const { isCompact, titleLineHeightPx, summaryLineHeightPx, summaryMaxLines, metaFontSizePx } =
    typography;
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
          <div className={`flex flex-col ${SKELETON_ROW_GUTTER_CLASS} ${sectionClassNames.header}`}>
            <div className="flex min-w-0 items-center justify-between gap-4">
              <div
                className={`flex min-w-0 flex-1 items-center ${isCompact ? "gap-2.5" : "gap-3"}`}
              >
                {showFavicons ? <Skeleton className="size-5.5 shrink-0 rounded-sm" /> : null}
                <Skeleton
                  className="w-28 rounded"
                  style={{ height: `${Math.max(13, metaFontSizePx)}px` }}
                />
              </div>
              <Skeleton
                className="w-16 shrink-0 rounded"
                style={{ height: `${Math.max(13, metaFontSizePx)}px` }}
              />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="w-full rounded" style={{ height: `${titleLineHeightPx}px` }} />
              <Skeleton className="w-[70%] rounded" style={{ height: `${titleLineHeightPx}px` }} />
            </div>
          </div>
          <div className={`space-y-1.5 ${SKELETON_ROW_GUTTER_CLASS}`}>
            <Skeleton className="w-full rounded" style={{ height: `${summaryLineHeightPx}px` }} />
            <Skeleton className="w-full rounded" style={{ height: `${summaryLineHeightPx}px` }} />
            {Array.from({ length: Math.max(0, summaryMaxLines - 2) }).map((_, index) => (
              <Skeleton
                key={`summary-line-${index}`}
                className={`rounded ${index === summaryMaxLines - 3 ? "w-4/5" : "w-full"}`}
                style={{ height: `${summaryLineHeightPx}px` }}
              />
            ))}
          </div>
          <div
            className={`flex w-full min-w-0 items-center ${SKELETON_ROW_GUTTER_CLASS} ${sectionClassNames.footer}`}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export type VirtualizedRowsProps = {
  listScrollRef: RefObject<HTMLDivElement | null>;
  initialScrollOffset?: number;
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
  initialScrollOffset,
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
  const restoredScrollOffsetRef = useRef<number | null>(null);
  const virtualizer = useVirtualizer({
    count: inboxItems.length,
    getItemKey: (index) => inboxItems[index]?.id ?? index,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => getFeedItemRowEstimate({ density, readerFocusMode }),
    initialOffset: initialScrollOffset,
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

  useLayoutEffect(() => {
    if (
      typeof initialScrollOffset !== "number" ||
      restoredScrollOffsetRef.current === initialScrollOffset ||
      isLoading ||
      inboxItems.length === 0 ||
      !listScrollRef.current
    ) {
      return;
    }

    restoredScrollOffsetRef.current = initialScrollOffset;
    virtualizer.scrollToOffset(initialScrollOffset, { behavior: "auto" });
  }, [inboxItems.length, initialScrollOffset, isLoading, listScrollRef, virtualizer]);

  if (isLoading && inboxItems.length === 0) {
    return (
      <SkeletonRows
        density={density}
        fontSizePx={fontSizePx}
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
