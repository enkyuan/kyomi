"use client";

import { useViewportMetrics } from "@hooks/use-viewport-metrics";
import { ToolbarOverlay, type ActiveToolbar } from "@modules/feeds/components/item/toolbar";
import { StaticRows, VirtualizedRows, SkeletonRows, type RowsPaginationState } from "./rows";
import { FilterMenu } from "./filter-menu";
import { Update } from "../refresh/update";
import { ScrollAreaPrimitive, ScrollBar } from "@vols.rss/ui/scroll-area";
import { AnimatePresence, LazyMotion, domAnimation, m, type Variants } from "motion/react";
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
import { STATIC_LIST_ITEM_LIMIT } from "@modules/inbox/lib/layout";

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

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

function RefreshStatus({
  isRefreshing,
  dataUpdatedAt,
}: {
  isRefreshing: boolean;
  dataUpdatedAt?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(dataUpdatedAt ?? null);
  const [tick, setTick] = useState(0);
  const hideTimeoutRef = useRef<number | null>(null);
  const wasRefreshingRef = useRef(isRefreshing);

  // Keep track of dataUpdatedAt updates from the query
  useEffect(() => {
    if (dataUpdatedAt) {
      setLastUpdated(dataUpdatedAt);

      // If we got a fresh update (and we weren't just mounting with old data),
      // or if it was refreshed, make it visible and start the 6s fade-out timer.
      if (!isRefreshing && wasRefreshingRef.current) {
        setIsVisible(true);
        if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = window.setTimeout(() => {
          setIsVisible(false);
        }, 6000);
      }
    }
  }, [dataUpdatedAt, isRefreshing]);

  // Handle active refreshing state transitions
  useEffect(() => {
    if (isRefreshing) {
      setIsVisible(true);
      if (hideTimeoutRef.current) {
        window.clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    } else if (wasRefreshingRef.current) {
      // Transition from refreshing -> idle
      setLastUpdated(Date.now());
      setIsVisible(true);
      if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = window.setTimeout(() => {
        setIsVisible(false);
      }, 6000);
    }
    wasRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  // If it mounts and has a recent update, show it briefly
  useEffect(() => {
    if (dataUpdatedAt && Date.now() - dataUpdatedAt < 30000) {
      setIsVisible(true);
      hideTimeoutRef.current = window.setTimeout(() => {
        setIsVisible(false);
      }, 6000);
    }
    return () => {
      if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  // Update relative time description every 15 seconds while visible
  useEffect(() => {
    if (!isVisible || isRefreshing || !lastUpdated) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 15000);
    return () => clearInterval(interval);
  }, [isVisible, isRefreshing, lastUpdated]);

  const relativeText = useMemo(() => {
    if (!lastUpdated) return "Updated now";
    const diffMs = Date.now() - lastUpdated;
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes <= 0) {
      return "Updated now";
    }
    return `Updated ${RELATIVE_TIME_FORMATTER.format(-diffMinutes, "minute")}`;
  }, [lastUpdated, tick]);

  const ENTER_EASE = [0.32, 0.72, 0, 1] as const;
  const EXIT_EASE = [0.7, 0, 0.84, 0] as const;

  const variants: Variants = {
    initial: { opacity: 0, scale: 0.96 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: {
        opacity: { duration: 0.4, ease: ENTER_EASE },
        scale: { duration: 0.4, ease: ENTER_EASE },
      },
    },
    exit: {
      opacity: 0,
      scale: 0.96,
      transition: {
        opacity: { duration: 0.3, ease: EXIT_EASE },
        scale: { duration: 0.3, ease: EXIT_EASE },
      },
    },
  };

  const pulseVariants: Variants = {
    initial: { opacity: 0.6 },
    animate: {
      opacity: [0.6, 1, 0.6],
      transition: {
        repeat: Infinity,
        duration: 1.5,
        ease: "easeInOut",
      },
    },
  };

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {isVisible && (
          <m.span
            key="refresh-status-root"
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="inline-flex items-center"
          >
            {/* Dot Separator: completely static once mounted */}
            <span
              aria-hidden="true"
              className="shrink-0 text-muted-foreground/50 mx-1.5 select-none"
            >
              ·
            </span>
            {/* Status Container: has same styling as inbox list item saved text */}
            <span className="font-medium tracking-[0.01em] text-muted-foreground/85 text-xs select-none">
              <AnimatePresence mode="wait">
                {isRefreshing ? (
                  <m.span
                    key="updating"
                    variants={pulseVariants}
                    initial="initial"
                    animate="animate"
                    className="inline-flex font-medium text-muted-foreground text-sm tabular-nums"
                  >
                    Updating
                  </m.span>
                ) : (
                  <m.span
                    key="updated"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="inline-flex font-medium text-muted-foreground text-sm tabular-nums"
                  >
                    {relativeText}
                  </m.span>
                )}
              </AnimatePresence>
            </span>
          </m.span>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}

function ListHeader({
  headerCount,
  isRefreshing,
  dataUpdatedAt,
  inboxItemsLength,
  feedId,
  folderId,
  filter,
  showHidden,
  showRead,
}: {
  headerCount: InboxListHeaderCount;
  isRefreshing: boolean;
  dataUpdatedAt?: number;
  inboxItemsLength: number;
  feedId?: string | null;
  folderId?: string | null;
  filter: InboxFilter;
  showHidden: boolean;
  showRead: boolean;
}) {
  const contextKey = feedId ?? folderId ?? "all";

  return (
    <div className="pointer-events-auto flex h-full items-center justify-between gap-3 pl-2.5 pr-2">
      <span className="inline-flex items-center whitespace-nowrap ps-1.5 font-medium text-muted-foreground text-sm tabular-nums">
        {headerCount.numberPart} {headerCount.unitPart}
        {inboxItemsLength > 0 ? (
          <RefreshStatus
            key={contextKey}
            isRefreshing={isRefreshing}
            dataUpdatedAt={dataUpdatedAt}
          />
        ) : null}
      </span>
      <div className="flex items-center gap-0.5">
        {feedId ? <Update feedId={feedId} /> : <Update folderId={folderId ?? undefined} />}
        <FilterMenu filter={filter} showHidden={showHidden} showRead={showRead} />
      </div>
    </div>
  );
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
  const { isLoading, isRefreshing, dataUpdatedAt } = pagination;
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

  return (
    <section
      className="relative flex h-full max-h-full min-h-80 min-w-0 flex-col overflow-hidden rounded-2xl supports-[-webkit-touch-callout:none]:rounded-[1.75rem] border border-border bg-card text-card-foreground [--inbox-header-height:3rem] md:min-h-0"
      aria-busy={isRefreshing || undefined}
      data-slot="inbox-list-root"
    >
      <ScrollAreaPrimitive.Root className="relative min-h-0 flex-1 overflow-hidden">
        <div
          ref={listHeaderRef}
          className="pointer-events-none absolute inset-x-0 top-0 z-30 h-(--inbox-header-height) border-b border-border bg-card"
          data-slot="inbox-list-header"
        >
          <ListHeader
            headerCount={headerCount}
            isRefreshing={isRefreshing}
            dataUpdatedAt={dataUpdatedAt}
            inboxItemsLength={inboxItems.length}
            feedId={feedId}
            folderId={folderId}
            filter={filter}
            showHidden={showHidden}
            showRead={showRead}
          />
        </div>
        <ScrollAreaPrimitive.Viewport
          ref={listScrollRef}
          className="h-full overflow-x-hidden outline-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden data-has-overflow-y:overscroll-y-contain"
          data-slot="inbox-list-viewport"
        >
          <div className="pt-(--inbox-header-height)">
            {!isVirtualizerHostMounted ? (
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
          <ScrollBar
            className="z-50 mt-(--inbox-header-height) h-[calc(100%-var(--inbox-header-height))]"
            orientation="vertical"
          />
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
