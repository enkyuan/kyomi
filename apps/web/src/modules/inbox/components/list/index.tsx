"use client";

import { cn } from "@lib/utils";
import { useViewportMetrics } from "@hooks/use-viewport-metrics";
import { ToolbarOverlay, type ActiveToolbar } from "@modules/feeds/components/item/toolbar";
import { SkeletonRows, StaticRows, VirtualizedRows } from "./feed-item-rows";
import { FilterMenu } from "./filter-menu";
import { Summary } from "../refresh/summary";
import { Update } from "../refresh/update";
import { ScrollAreaPrimitive, ScrollBar, scrollbarThinExpandClass } from "@vols.rss/ui/scroll-area";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type PointerEvent,
} from "react";
import type { InboxFilter, InboxItem } from "@modules/inbox/services/api";
import type { InboxDensityDto, InboxTimestampDisplayDto } from "@lib/schemas";
import type { InboxListHeaderCount } from "@modules/inbox/utils/count-display";
import { STATIC_LIST_ITEM_LIMIT } from "@modules/inbox/lib/list-layout";
import type { RowsPaginationState } from "./feed-item-rows";

export type ListDisplayOptions = {
  readerFocusMode?: boolean;
  disableVirtualization?: boolean;
  showFavicons: boolean;
};

export type ListFilterVisibility = {
  showHidden?: boolean;
  showRead?: boolean;
};

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
  feedId?: string | null;
  folderId?: string | null;
  pagination: RowsPaginationState;
  onSelectItem: (item: InboxItem) => void;
}

export function List({
  inboxItems,
  headerCount,
  filter,
  display,
  filterVisibility,
  density,
  fontSizePx,
  timestampDisplay,
  timestampHourCycle,
  selectedItemId,
  feedId,
  folderId,
  pagination,
  onSelectItem,
}: ListProps) {
  const { readerFocusMode = false, disableVirtualization = false, showFavicons } = display;
  const { showHidden = false, showRead = false } = filterVisibility ?? {};
  const { isLoading } = pagination;
  const [activeToolbar, setActiveToolbar] = useState<ActiveToolbar | null>(null);
  const activeToolbarRef = useRef<ActiveToolbar | null>(null);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const listHeaderRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const { containerWidth: listContainerWidth, viewportHeight } = useViewportMetrics(listScrollRef, [
    inboxItems.length,
    isLoading,
    density,
    fontSizePx,
    readerFocusMode,
  ]);
  const inboxItemById = useMemo(
    () => new Map(inboxItems.map((item) => [item.id, item])),
    [inboxItems],
  );
  const shouldUseStaticList = disableVirtualization && inboxItems.length <= STATIC_LIST_ITEM_LIMIT;
  const isVirtualizerHostMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    activeToolbarRef.current = activeToolbar;
  }, [activeToolbar]);

  const showToolbar = useCallback(
    (item: InboxItem, anchorElement: HTMLElement, toolbarHostElement: HTMLElement) => {
      const nextToolbar = { item, anchorElement, toolbarHostElement };
      activeToolbarRef.current = nextToolbar;
      setActiveToolbar(nextToolbar);
    },
    [],
  );

  const hideToolbar = useCallback((event: FocusEvent<HTMLElement> | PointerEvent<HTMLElement>) => {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node) {
      if (activeToolbarRef.current?.anchorElement.contains(relatedTarget)) {
        return;
      }
      if (toolbarRef.current?.contains(relatedTarget)) {
        return;
      }
    }

    activeToolbarRef.current = null;
    setActiveToolbar(null);
  }, []);
  const activeToolbarItem = activeToolbar ? inboxItemById.get(activeToolbar.item.id) : null;
  const visibleActiveToolbar =
    activeToolbar && activeToolbarItem ? { ...activeToolbar, item: activeToolbarItem } : null;

  return (
    <section
      className="relative flex h-full max-h-full min-h-80 min-w-0 flex-col overflow-hidden rounded-2xl supports-[-webkit-touch-callout:none]:rounded-[1.75rem] border border-border bg-card text-card-foreground [--inbox-header-height:3rem] md:min-h-0"
      data-slot="inbox-list-root"
    >
      <div
        ref={listHeaderRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-30 h-(--inbox-header-height) border-b border-border bg-card"
        data-slot="inbox-list-header"
      >
        <div className="pointer-events-auto flex h-full items-center justify-between gap-3 pl-2.5 pr-2">
          <span className="inline-flex items-center whitespace-nowrap ps-1.5 font-medium text-muted-foreground text-sm tabular-nums">
            {headerCount.numberPart} {headerCount.unitPart}
            {feedId ? <Summary feedId={feedId} /> : null}
          </span>
          <div className="flex items-center gap-0.5">
            {feedId ? <Update feedId={feedId} /> : <Update folderId={folderId ?? undefined} />}
            <FilterMenu filter={filter} showHidden={showHidden} showRead={showRead} />
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
                <SkeletonRows
                  density={density}
                  showFavicons={showFavicons}
                  readerFocusMode={readerFocusMode}
                  viewportHeight={viewportHeight}
                />
              ) : inboxItems.length === 0 ? null : (
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
                onToolbarEnter={showToolbar}
                onToolbarLeave={hideToolbar}
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
                onToolbarEnter={showToolbar}
                onToolbarLeave={hideToolbar}
                viewportHeight={viewportHeight}
              />
            )}
          </div>
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar
          className={cn(
            "z-50 mt-(--inbox-header-height) h-[calc(100%-var(--inbox-header-height))]",
            scrollbarThinExpandClass,
          )}
          orientation="vertical"
        />
      </ScrollAreaPrimitive.Root>
      <ToolbarOverlay
        activeToolbar={visibleActiveToolbar}
        filter={filter}
        headerElement={listHeaderRef.current}
        viewportElement={listScrollRef.current}
        toolbarRef={toolbarRef}
        onToolbarPointerLeave={hideToolbar}
      />
    </section>
  );
}
