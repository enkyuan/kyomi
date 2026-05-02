"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useNavigate } from "@tanstack/react-router";
import { FeedItem } from "@modules/inbox/item";
import { InboxListFilterMenu } from "@modules/inbox/list-filter-menu";
import { FeedRefreshStatus } from "@modules/inbox/refresh-status";
import { ScrollAreaPrimitive, ScrollBar } from "@components/ui/scroll-area";
import { Skeleton } from "@components/ui/skeleton";
import { useViewportMetrics } from "@hooks/use-viewport-metrics";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { InboxFilter, InboxItem } from "@modules/inbox/api";

const FEED_ITEM_ROW_ESTIMATE = 176;

interface InboxListProps {
  inboxItems: InboxItem[];
  viewCount: number;
  filter: InboxFilter;
  activeScopeLabel?: "hidden" | "read";
  selectedItemId?: string;
  feedId?: string;
  showHidden?: boolean;
  showRead?: boolean;
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

function InboxListSkeletonRows() {
  return (
    <ul className="w-full">
      {Array.from({ length: 6 }).map((_, index) => (
        <li
          key={`skeleton-${index}`}
          className={`w-full border-x-0 border-border/70 bg-transparent${index === 0 ? "" : " border-t"}`}
        >
          <div className="flex flex-col gap-2 px-5 py-3">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4.5 shrink-0 rounded-[3px]" />
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
            <Skeleton className="h-3.5 w-4/5 rounded" />
          </div>
          <div className="mt-2 px-5 pb-3">
            <Skeleton className="h-3 w-28 rounded" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function InboxListVirtualized({
  listScrollRef,
  allowFirstRowOverlay,
  inboxItems,
  selectedItemId,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onSelectItem,
}: {
  listScrollRef: RefObject<HTMLDivElement | null>;
  allowFirstRowOverlay: boolean;
  inboxItems: InboxItem[];
  selectedItemId?: string;
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  onSelectItem: (itemId: string) => void;
}) {
  const virtualizer = useVirtualizer({
    count: inboxItems.length,
    getItemKey: (index) => inboxItems[index]?.id ?? index,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => FEED_ITEM_ROW_ESTIMATE,
    overscan: 6,
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

  const { viewportHeight: listViewportHeight, containerWidth: listContainerWidth } =
    useViewportMetrics(listScrollRef, [isLoading, inboxItems.length, listContentHeight]);

  const showBottomSeparatorOnLastItem =
    inboxItems.length > 0 && listContentHeight < listViewportHeight;

  if (isLoading && inboxItems.length === 0) {
    return <InboxListSkeletonRows />;
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
            className={`group/inbox-row absolute left-0 top-0 z-0 w-full${virtualRow.index === 0 && allowFirstRowOverlay ? " hover:z-40 focus-within:z-40" : ""}`}
            data-index={virtualRow.index}
            style={{
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <FeedItem
              item={item}
              isSelected={selectedItemId === item.id}
              isFirst={virtualRow.index === 0}
              containerWidth={listContainerWidth || undefined}
              showBottomSeparator={
                showBottomSeparatorOnLastItem && virtualRow.index === inboxItems.length - 1
              }
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
  viewCount,
  filter,
  activeScopeLabel,
  selectedItemId,
  feedId,
  showHidden = false,
  showRead = false,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: InboxListProps) {
  const [isVirtualizerHostMounted, setIsVirtualizerHostMounted] = useState(false);
  const [allowFirstRowOverlay, setAllowFirstRowOverlay] = useState(true);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);

  useEffect(() => {
    setIsVirtualizerHostMounted(true);
  }, []);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    const node = listScrollRef.current;
    if (!node) {
      return;
    }

    const syncOverlayState = () => {
      setAllowFirstRowOverlay(node.scrollTop <= 1);
    };

    syncOverlayState();
    node.addEventListener("scroll", syncOverlayState, { passive: true });
    return () => node.removeEventListener("scroll", syncOverlayState);
  }, []);

  const handleSelectItem = useCallback((itemId: string) => {
    void navigateRef.current({
      from: "/inbox/",
      search: (prev) => ({
        ...prev,
        itemId,
      }),
    });
  }, []);

  const countLabel =
    activeScopeLabel ?? (filter === "today" ? "today" : filter === "saved" ? "saved" : "unread");

  return (
    <section className="relative flex h-full max-h-full min-h-80 min-w-0 flex-col overflow-hidden rounded-2xl supports-[-webkit-touch-callout:none]:rounded-[1.75rem] border border-border bg-card text-card-foreground [--inbox-header-height:2.75rem] md:min-h-0">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-[var(--inbox-header-height)] border-b border-border bg-card">
        <div className="pointer-events-auto flex h-full items-center justify-between gap-3 px-2">
          <span className="ps-1 font-medium text-muted-foreground text-sm tabular-nums">
            {viewCount} {countLabel}
          </span>
          <div className="flex items-center gap-0.5">
            {feedId ? <FeedRefreshStatus feedId={feedId} /> : null}
            {filter === "unread" ? (
              <InboxListFilterMenu showHidden={showHidden} showRead={showRead} />
            ) : null}
          </div>
        </div>
      </div>
      <ScrollAreaPrimitive.Root className="min-h-0 flex-1 overflow-hidden">
        <ScrollAreaPrimitive.Viewport
          ref={listScrollRef}
          className="h-full overflow-x-hidden outline-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden data-has-overflow-y:overscroll-y-contain"
          data-slot="inbox-list-viewport"
        >
          <div className="pt-[var(--inbox-header-height)]">
            {!isVirtualizerHostMounted ? (
              isLoading && inboxItems.length === 0 ? (
                <InboxListSkeletonRows />
              ) : inboxItems.length === 0 ? null : (
                <InboxListSkeletonRows />
              )
            ) : (
              <InboxListVirtualized
                listScrollRef={listScrollRef}
                allowFirstRowOverlay={allowFirstRowOverlay}
                inboxItems={inboxItems}
                selectedItemId={selectedItemId}
                isLoading={isLoading}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                fetchNextPage={fetchNextPage}
                onSelectItem={handleSelectItem}
              />
            )}
          </div>
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar
          className="z-50 mt-[var(--inbox-header-height)] h-[calc(100%-var(--inbox-header-height))]"
          orientation="vertical"
        />
      </ScrollAreaPrimitive.Root>
    </section>
  );
}
