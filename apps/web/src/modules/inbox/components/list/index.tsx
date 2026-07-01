"use client";

import { useViewport } from "@hooks/use-viewport";
import { StaticRows, VirtualizedRows, SkeletonRows, type RowsPaginationState } from "./rows";
import { ScrollAreaPrimitive, ScrollBar } from "@kyomi/ui/scroll-area";
import { BookmarkFill, NewsFill, TimeDurationFill } from "@mingcute/react";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { useHydrated } from "@hooks/use-hydrated";
import type { InboxFilter, InboxItem, InboxSort } from "@modules/inbox/services/api";
import type { ArticleDetailDto, InboxDensityDto, InboxTimestampDisplayDto } from "@lib/schemas";
import { STATIC_LIST_ITEM_LIMIT } from "@modules/inbox/lib/layout";
import { BackToInboxButton, DEFAULT_SORT, FilterControl, SearchBar, SortButton } from "./header";
import { Toolbar as ReaderToolbar } from "@modules/reader/components/toolbar";
import { useToolbar as useReaderToolbar } from "@modules/reader/hooks/use-toolbar";

export type ListDisplayOptions = {
  readerFocusMode?: boolean;
  disableVirtualization?: boolean;
  showFavicons: boolean;
};

function getEmptyStateCopy(filter: InboxFilter) {
  switch (filter) {
    case "my-feed":
      return {
        title: "No stories in My Feed",
        description: "Articles from feeds you follow will appear here as they publish.",
      };
    case "saved":
      return {
        title: "Nothing saved yet",
        description: "Saved articles will appear here when you mark them for later.",
      };
    case "recent":
      return {
        title: "No recent reads",
        description: "Articles you open will show up here after you read them.",
      };
    case "all":
    default:
      return {
        title: "No articles yet",
        description: "New stories will show up here after feeds publish or refresh.",
      };
  }
}

function EmptyStateIcon({ filter }: { filter: InboxFilter }) {
  const Icon =
    filter === "saved" ? BookmarkFill : filter === "recent" ? TimeDurationFill : NewsFill;

  return (
    <div className="flex size-32 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground/80 ring-1 ring-border/60 sm:size-36">
      <Icon className="size-14 sm:size-16" aria-hidden="true" />
    </div>
  );
}

interface ListProps {
  inboxItems: InboxItem[];
  filter: InboxFilter;
  display: ListDisplayOptions;
  density: InboxDensityDto;
  fontSizePx: number;
  timestampDisplay: InboxTimestampDisplayDto;
  timestampHourCycle: "12h" | "24h";
  selectedItemId?: string | null;
  pagination: RowsPaginationState;
  onSelectItem: (item: InboxItem) => void;
  onFilterChange?: (filter: InboxFilter) => void;
  onBackToInbox?: () => void;
  onBackToList?: () => void;
  onSortChange: (sort: InboxSort) => void;
  sort?: InboxSort;
  isFeedScoped?: boolean;
  isArticleScoped?: boolean;
  feedLabel?: string;
  selectedArticle?: ArticleDetailDto | null;
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
  onBackToInbox,
  onBackToList,
  onSortChange,
  sort,
  isFeedScoped = false,
  isArticleScoped = false,
  feedLabel,
  selectedArticle,
}: ListProps) {
  const { readerFocusMode = false, disableVirtualization = false, showFavicons } = display;
  const { isLoading, isRefreshing } = pagination;
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const listHeaderRef = useRef<HTMLDivElement | null>(null);
  const listToolsRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const scopeControlTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.28, bounce: 0 };

  const { containerWidth: listContainerWidth, viewportHeight } = useViewport(listScrollRef, [
    inboxItems.length,
    isLoading,
    density,
    fontSizePx,
    readerFocusMode,
  ]);
  const shouldUseStaticList = disableVirtualization && inboxItems.length <= STATIC_LIST_ITEM_LIMIT;
  const isVirtualizerHostMounted = useHydrated();

  const showEmptyState = isVirtualizerHostMounted && !isLoading && inboxItems.length === 0;
  const emptyState = getEmptyStateCopy(filter);
  const showScopedHeader = isArticleScoped || isFeedScoped;
  const backAction = isArticleScoped ? onBackToList : onBackToInbox;

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
                className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-2 px-3 pt-4.5 pb-2 isolate"
                data-slot="inbox-list-header"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <LazyMotion features={domAnimation}>
                    <m.div
                      layout
                      className="inline-flex shrink-0"
                      transition={scopeControlTransition}
                    >
                      <AnimatePresence initial={false} mode="popLayout">
                        {showScopedHeader && backAction ? (
                          <m.div
                            key={isArticleScoped ? "article-back" : "feed-back"}
                            layout
                            className="flex min-w-0 items-center gap-2"
                            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.96 }}
                            transition={scopeControlTransition}
                          >
                            <BackToInboxButton onClick={backAction} />
                            {isArticleScoped && selectedArticle ? (
                              <HeaderReaderToolbar item={selectedArticle} />
                            ) : feedLabel ? (
                              <span className="relative inline-flex h-11 min-w-0 max-w-72 items-center overflow-hidden rounded-full bg-background px-4 font-medium text-base text-muted-foreground before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-muted [&>*]:relative">
                                <span className="truncate">{feedLabel}</span>
                              </span>
                            ) : null}
                          </m.div>
                        ) : (
                          <m.div
                            key="filter-tabs"
                            layout
                            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.98 }}
                            transition={scopeControlTransition}
                          >
                            <FilterControl filter={filter} onFilterChange={onFilterChange} />
                          </m.div>
                      )}
                    </AnimatePresence>
                  </m.div>
                </LazyMotion>
                </div>
                <div
                  ref={listToolsRef}
                  className="flex min-w-0 flex-1 items-center justify-end gap-2"
                >
                  <SearchBar />
                  <LazyMotion features={domAnimation}>
                    <AnimatePresence initial={false} mode="popLayout">
                      {!isArticleScoped ? (
                        <m.div
                          key="sort"
                          layout
                          initial={prefersReducedMotion ? false : { opacity: 0, x: -8, scale: 0.96 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={
                            prefersReducedMotion
                              ? undefined
                              : { opacity: 0, x: -8, scale: 0.96 }
                          }
                          transition={scopeControlTransition}
                        >
                          <SortButton
                            sort={sort ?? DEFAULT_SORT}
                            anchor={listToolsRef}
                            onSortChange={onSortChange}
                          />
                        </m.div>
                      ) : null}
                    </AnimatePresence>
                  </LazyMotion>
                </div>
              </div>
            ) : null}
            <div className={showEmptyState ? "flex flex-1 flex-col" : ""}>
              {showEmptyState ? (
                <div className="flex flex-1 min-h-72 w-full flex-col items-center justify-center gap-5 px-3 py-10 text-center">
                  <EmptyStateIcon filter={filter} />
                  <div className="w-full max-w-136 space-y-2">
                    <p className="text-base font-semibold text-foreground">{emptyState.title}</p>
                    <p className="mx-auto max-w-110 text-balance text-sm leading-6 text-muted-foreground">
                      {emptyState.description}
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

function HeaderReaderToolbar({ item }: { item: ArticleDetailDto }) {
  const toolbar = useReaderToolbar({ item });

  return (
    <div className="relative inline-flex h-11 min-w-0 max-w-96 items-center overflow-hidden rounded-full bg-background px-1.5 font-medium text-base text-muted-foreground before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-muted [&>*]:relative">
      <ReaderToolbar {...toolbar.toolbarProps} />
    </div>
  );
}
