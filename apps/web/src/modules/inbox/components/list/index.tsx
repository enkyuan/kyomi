"use client";

import { useViewportMetrics } from "@hooks/use-viewport-metrics";
import { ToolbarOverlay, type ActiveToolbar } from "@modules/feeds/components/item/toolbar";
import { StaticRows, VirtualizedRows, SkeletonRows, type RowsPaginationState } from "./rows";
import { ScrollAreaPrimitive, ScrollBar } from "@kyomi/ui/scroll-area";
import {
  SegmentedControl,
  SegmentedControlList,
  SegmentedControlTab,
} from "@kyomi/ui/segmented-control";
import { EmptyStateIcon } from "@kyomi/ui/icons/empty-state";
import { Menu, MenuTrigger, MenuPopup, MenuItem } from "@kyomi/ui/menu";
import { Badge } from "@kyomi/ui/badge";
import { DownFill, BookmarkFill, HistoryFill, type IconProps } from "@mingcute/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type FocusEvent,
  type PointerEvent,
} from "react";
import type { InboxFilter, InboxItem } from "@modules/inbox/services/api";
import type { InboxDensityDto, InboxTimestampDisplayDto } from "@lib/schemas";
import type { InboxListHeaderCount } from "@modules/inbox/utils/count-display";
import { STATIC_LIST_ITEM_LIMIT } from "@modules/inbox/lib/layout";

export type ListDisplayOptions = {
  readerFocusMode?: boolean;
  disableVirtualization?: boolean;
  showFavicons: boolean;
};

export type ListFilterVisibility = {
  showHidden?: boolean;
  showRead?: boolean;
};

const ALL_FILTER_GROUP: InboxFilter[] = ["inbox", "saved", "recent"];

const ALL_FILTER_MENU: {
  value: InboxFilter;
  label: string;
  icon: ComponentType<IconProps>;
}[] = [
  { value: "saved", label: "Saved", icon: BookmarkFill },
  { value: "recent", label: "Recent", icon: HistoryFill },
];

function formatFilterCount(count: number | undefined | null): string | null {
  if (count === undefined || count === null || count <= 0) {
    return null;
  }
  if (count > 999) {
    return "999+";
  }
  return String(count);
}

const EMPTY_STATE_BODY_COPY =
  "Stories from your feeds appear here so you can preview them before opening the original source.";

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
  onFilterChange?: (filter: InboxFilter) => void;
  filterCounts?: Partial<Record<InboxFilter, number>>;
}

function FilterControl({
  filter,
  onFilterChange,
  filterCounts,
}: {
  filter: InboxFilter;
  onFilterChange: (filter: InboxFilter) => void;
  filterCounts?: Partial<Record<InboxFilter, number>>;
}) {
  const segmentedRef = useRef<HTMLDivElement | null>(null);
  const isAllGroupActive = ALL_FILTER_GROUP.includes(filter);
  const activeAllLabel = filter === "saved" ? "Saved" : filter === "recent" ? "Recent" : "All";
  const segmentValue: InboxFilter =
    filter === "today" ? "today" : isAllGroupActive ? filter : "inbox";

  return (
    <div ref={segmentedRef} className="inline-flex w-fit">
      <SegmentedControl
        className="w-fit"
        value={segmentValue}
        onValueChange={(v) => onFilterChange(v as InboxFilter)}
      >
        <SegmentedControlList>
          <SegmentedControlTab value="today">My Feed</SegmentedControlTab>
          <SegmentedControlTab
            value={segmentValue === "today" ? "inbox" : segmentValue}
            className="gap-1.5 pe-2.5"
          >
            <span className="leading-none">{activeAllLabel}</span>
            <Menu>
              <MenuTrigger
                render={
                  <button
                    type="button"
                    aria-label="Choose filter"
                    className="-me-0.5 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center self-center rounded-full leading-none text-current outline-none transition-colors hover:bg-accent"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") event.stopPropagation();
                    }}
                  />
                }
              >
                <DownFill className="size-3" />
              </MenuTrigger>
              <MenuPopup
                align="center"
                side="bottom"
                sideOffset={6}
                anchor={segmentedRef}
                className="w-(--anchor-width) min-w-(--anchor-width) rounded-[22px] p-1 before:rounded-[21px]"
              >
                {ALL_FILTER_MENU.map((item) => {
                  const Icon = item.icon;
                  const countLabel = formatFilterCount(filterCounts?.[item.value]);
                  return (
                    <MenuItem
                      key={item.value}
                      className="h-9 justify-between gap-2 rounded-full px-3 font-medium text-base sm:h-9 sm:text-base"
                      onClick={() => onFilterChange(item.value)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon className="size-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {countLabel ? (
                        <Badge variant="secondary" size="sm" className="rounded-full">
                          {countLabel}
                        </Badge>
                      ) : null}
                    </MenuItem>
                  );
                })}
              </MenuPopup>
            </Menu>
          </SegmentedControlTab>
        </SegmentedControlList>
      </SegmentedControl>
    </div>
  );
}

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
}: ListProps) {
  const { readerFocusMode = false, disableVirtualization = false, showFavicons } = display;
  const { isLoading, isRefreshing } = pagination;
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
      const nextToolbar = {
        item,
        anchorElement,
        toolbarHostElement,
      };
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

  const showEmptyState = isVirtualizerHostMounted && !isLoading && inboxItems.length === 0;

  return (
    <section
      className="relative flex h-full max-h-full min-h-80 min-w-0 flex-col overflow-hidden [--inbox-header-height:3rem] md:min-h-0"
      aria-busy={isRefreshing || undefined}
      data-slot="inbox-list-root"
    >
      {onFilterChange ? (
        <div className="px-3 pt-[18px] pb-2">
          <FilterControl
            filter={filter}
            onFilterChange={onFilterChange}
            filterCounts={filterCounts}
          />
        </div>
      ) : null}
      <ScrollAreaPrimitive.Root className="relative min-h-0 flex-1 overflow-hidden">
        <ScrollAreaPrimitive.Viewport
          ref={listScrollRef}
          className="h-full overflow-x-hidden outline-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden data-has-overflow-y:overscroll-y-contain"
          data-slot="inbox-list-viewport"
        >
          <div className={showEmptyState ? "flex h-full flex-col" : ""}>
            {showEmptyState ? (
              <div className="flex flex-1 min-h-72 w-full flex-col items-center justify-center gap-5 px-6 py-10 text-center">
                <EmptyStateIcon className="size-40 shrink-0 sm:size-44" height={176} width={176} />
                <div className="w-full max-w-136 space-y-2">
                  <p className="text-base font-semibold text-foreground">
                    Select an item to start reading
                  </p>
                  <p className="mx-auto max-w-110 text-balance text-sm leading-6 text-muted-foreground">
                    {EMPTY_STATE_BODY_COPY}
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
        {inboxItems.length > 0 || isLoading ? (
          <ScrollBar className="z-50" orientation="vertical" />
        ) : null}
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
