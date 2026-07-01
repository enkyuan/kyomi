"use client";

import { useViewportMetrics } from "@hooks/use-viewport-metrics";
import { StaticRows, VirtualizedRows, SkeletonRows, type RowsPaginationState } from "./rows";
import { ScrollAreaPrimitive, ScrollBar } from "@kyomi/ui/scroll-area";
import { EmptyStateIcon } from "@kyomi/ui/icons/empty-state";
import { Badge } from "@kyomi/ui/badge";
import { useRef } from "react";
import { useHydrated } from "@hooks/use-hydrated";
import type { InboxFilter, InboxItem, InboxSort } from "@modules/inbox/services/api";
import type { InboxDensityDto, InboxTimestampDisplayDto } from "@lib/schemas";
import type { InboxListHeaderCount } from "@modules/inbox/utils/count-display";
import { STATIC_LIST_ITEM_LIMIT } from "@modules/inbox/lib/layout";
import { DEFAULT_SORT, FilterControl, SearchBar, SortButton } from "./header";

export type ListDisplayOptions = {
  readerFocusMode?: boolean;
  disableVirtualization?: boolean;
  showFavicons: boolean;
};

export type ListFilterVisibility = {
  showHidden?: boolean;
  showRead?: boolean;
};

const EMPTY_STATE_BODY_COPY =
  "Follow feeds to start building your reading list. New stories will show up here as they're published.";

interface ListProps {
  inboxItems: InboxItem[];
  headerCount: InboxListHeaderCount;
  filter: InboxFilter;
  display: ListDisplayOptions;
  filterVisibility?: ListFilterVisibility;
  density: InboxDensityDto;
  fontSizePx: number;
  timestampDisplay: InboxTimestampDisplayDto;
  timestampHourCycle: "12h" | "24h";
  selectedItemId?: string | null;
  pagination: RowsPaginationState;
  onSelectItem: (item: InboxItem) => void;
  onFilterChange?: (filter: InboxFilter) => void;
  filterCounts?: Partial<Record<InboxFilter, number>>;
  sort?: InboxSort;
}

// oxlint-disable-next-line eslint/complexity
export function List({
  inboxItems,
  filter,
  display,
  density,
  fontSizePx,
  timestampDisplay,
  timestampHourCycle,
  selectedItemId,
  pagination,
  onSelectItem,
  onFilterChange,
  filterCounts,
  sort,
}: ListProps) {
  const { readerFocusMode = false, disableVirtualization = false, showFavicons } = display;
  const { isLoading, isRefreshing } = pagination;
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const listHeaderRef = useRef<HTMLDivElement | null>(null);
  const listToolsRef = useRef<HTMLDivElement | null>(null);

  const { containerWidth: listContainerWidth, viewportHeight } = useViewportMetrics(listScrollRef, [
    inboxItems.length,
    isLoading,
    density,
    fontSizePx,
    readerFocusMode,
  ]);
  const shouldUseStaticList = disableVirtualization && inboxItems.length <= STATIC_LIST_ITEM_LIMIT;
  const isVirtualizerHostMounted = useHydrated();

  const showEmptyState = isVirtualizerHostMounted && !isLoading && inboxItems.length === 0;
  const isAllEmptyState = filter === "all";
  const emptyStateBodyCopy = isAllEmptyState
    ? "New stories will show up here after feeds publish or refresh."
    : EMPTY_STATE_BODY_COPY;

  return (
    <section
      className="relative flex h-full max-h-full min-h-80 min-w-0 flex-col overflow-hidden [--inbox-header-height:3rem] md:min-h-0"
      aria-busy={isRefreshing || undefined}
      data-slot="inbox-list-root"
    >
      <ScrollAreaPrimitive.Root className="relative min-h-0 flex-1 overflow-hidden">
        <ScrollAreaPrimitive.Viewport
          ref={listScrollRef}
          className="h-full overflow-x-hidden outline-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden data-has-overflow-y:overscroll-y-contain"
          data-slot="inbox-list-viewport"
        >
          <div
            className={
              showEmptyState ? "flex h-full min-h-full flex-col" : "flex min-h-full flex-col"
            }
          >
            {onFilterChange ? (
              <div
                ref={listHeaderRef}
                className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-2 px-3 pt-[18px] pb-2 isolate"
                data-slot="inbox-list-header"
              >
                <FilterControl
                  filter={filter}
                  onFilterChange={onFilterChange}
                  filterCounts={filterCounts}
                />
                <div ref={listToolsRef} className="flex items-center gap-2">
                  <SearchBar />
                  <SortButton sort={sort ?? DEFAULT_SORT} anchor={listToolsRef} />
                </div>
              </div>
            ) : null}
            <div className={showEmptyState ? "flex flex-1 flex-col" : ""}>
              {showEmptyState ? (
                <div className="flex flex-1 min-h-72 w-full flex-col items-center justify-center gap-5 px-3 py-10 text-center">
                  <EmptyStateIcon
                    className="size-40 shrink-0 sm:size-44"
                    height={174}
                    width={174}
                  />
                  <div className="w-full max-w-136 space-y-2">
                    <p className="text-base font-semibold text-foreground">
                      {isAllEmptyState ? (
                        "No articles yet"
                      ) : (
                        <>
                          Add a new feed or check out{" "}
                          <Badge variant="secondary" size="lg">
                            All
                          </Badge>{" "}
                          to get started
                        </>
                      )}
                    </p>
                    <p className="mx-auto max-w-110 text-balance text-sm leading-6 text-muted-foreground">
                      {emptyStateBodyCopy}
                    </p>
                  </div>
                </div>
              ) : !isVirtualizerHostMounted ? (
                inboxItems.length === 0 && !isLoading ? null : (
                  <SkeletonRows
                    density={density}
                    showFavicons={showFavicons}
                    readerFocusMode={readerFocusMode}
                    viewportHeight={viewportHeight}
                  />
                )
              ) : shouldUseStaticList ? (
                <StaticRows
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
                <VirtualizedRows
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
                  pagination={pagination}
                  onSelectItem={onSelectItem}
                  viewportHeight={viewportHeight}
                />
              )}
            </div>
          </div>
        </ScrollAreaPrimitive.Viewport>
        {inboxItems.length > 0 || isLoading ? (
          <ScrollBar
            aria-label="Inbox list scrollbar"
            className="z-50 !fixed !top-0 !right-0 !bottom-0 !left-auto !h-auto !inset-inline-end-0"
            orientation="vertical"
          />
        ) : null}
      </ScrollAreaPrimitive.Root>
    </section>
  );
}
