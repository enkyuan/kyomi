"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, type FocusEvent, type PointerEvent, type RefObject } from "react";
import type { InboxDensityDto, InboxTimestampDisplayDto } from "@lib/schemas";
import { Item } from "@modules/feeds/components/item";
import type { InboxFilter, InboxItem } from "@modules/inbox/services/api";
import { getFeedItemRowEstimate } from "@modules/inbox/lib/list-layout";
import { SkeletonRows, type RowsPaginationState } from "./feed-item-rows";

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
  onToolbarEnter: (
    item: InboxItem,
    anchorElement: HTMLElement,
    toolbarHostElement: HTMLElement,
  ) => void;
  onToolbarLeave: (event: FocusEvent<HTMLElement> | PointerEvent<HTMLElement>) => void;
  viewportHeight?: number;
};

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
}: VirtualizedRowsProps) {
  const toolbarHostRef = useRef<HTMLDivElement | null>(null);
  const showToolbar = (item: InboxItem, anchorElement: HTMLElement) => {
    if (toolbarHostRef.current) {
      onToolbarEnter(item, anchorElement, toolbarHostRef.current);
    }
  };
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
      ref={toolbarHostRef}
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
              onToolbarEnter={showToolbar}
              onToolbarLeave={onToolbarLeave}
            />
          </div>
        );
      })}
    </div>
  );
}
