"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { Filter2Fill } from "@mingcute/react";
import { useNavigate } from "@tanstack/react-router";
import { FeedItem } from "@components/pages/inbox/feed-item";
import { FeedRefreshStatus } from "@components/pages/inbox/feed-refresh-status";
import { ScrollAreaPrimitive, ScrollBar } from "@components/ui/scroll-area";
import { Skeleton } from "@components/ui/skeleton";
import { useViewportMetrics } from "@hooks/use-viewport-metrics";
import { Route } from "@/routes/inbox/index";
import { useEffect, useRef } from "react";
import type { InboxFilter, InboxItem } from "@lib/inbox-functions";

const FEED_ITEM_ROW_ESTIMATE = 176;

interface InboxListProps {
  inboxItems: InboxItem[];
  viewCount: number;
  filter: InboxFilter;
  selectedItemId?: string;
  feedId?: string;
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

export function InboxList({
  inboxItems,
  viewCount,
  filter,
  selectedItemId,
  feedId,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: InboxListProps) {
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

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

  const {
    viewportHeight: listViewportHeight,
    containerWidth: listContainerWidth,
    hasVerticalOverflow: hasListVerticalOverflow,
  } = useViewportMetrics(listScrollRef, [isLoading, inboxItems.length, listContentHeight]);

  const showBottomSeparatorOnLastItem =
    inboxItems.length > 0 && listContentHeight < listViewportHeight;

  const countLabel = filter === "today" ? "today" : filter === "saved" ? "saved" : "unread";

  return (
    <section className="flex h-full max-h-full min-h-80 min-w-0 flex-col overflow-hidden rounded-2xl supports-[-webkit-touch-callout:none]:rounded-[1.75rem] border border-border bg-card text-card-foreground md:min-h-0">
      <div className="sticky top-0 z-10 shrink-0 border-b border-border bg-card">
        <div className="flex items-center justify-between gap-3 px-2 py-2">
          <span className="ps-1 font-medium text-muted-foreground text-sm tabular-nums">
            {viewCount} {countLabel}
          </span>
          <div className="flex items-center gap-0.5">
            {feedId ? <FeedRefreshStatus feedId={feedId} /> : null}
            <button
              type="button"
              aria-label="Feed filters coming soon"
              className="inline-flex size-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              <Filter2Fill className="size-4" />
            </button>
          </div>
        </div>
      </div>
      <ScrollAreaPrimitive.Root className="min-h-0 flex-1 overflow-hidden">
        <ScrollAreaPrimitive.Viewport
          ref={listScrollRef}
          className="h-full overflow-x-hidden outline-none data-has-overflow-y:overscroll-y-contain"
          data-slot="inbox-list-viewport"
        >
          {isLoading && inboxItems.length === 0 ? (
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
          ) : inboxItems.length === 0 ? null : (
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
                    className="absolute left-0 top-0 w-full"
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
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
                      onSelect={() => {
                        void navigate({
                          from: Route.fullPath,
                          search: (prev) => ({
                            ...prev,
                            itemId: item.id,
                          }),
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </ScrollAreaPrimitive.Viewport>
        {hasListVerticalOverflow ? <ScrollBar orientation="vertical" /> : null}
      </ScrollAreaPrimitive.Root>
    </section>
  );
}
