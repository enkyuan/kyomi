"use client";

import { useViewport } from "@modules/inbox/hooks/use-viewport";
import { VirtualizedRows, SkeletonRows, type RowsPaginationState } from "./rows";
import { Badge } from "@kyomi/ui/components/badge";
import { ScrollAreaPrimitive, ScrollBar } from "@kyomi/ui/components/scroll-area";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@kyomi/ui/components/empty";
import { EmptyStateIcon } from "@kyomi/ui/icons/empty-state";
import { useElementScrollRestoration } from "@tanstack/react-router";
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  controlSwapMotion,
  m,
  useReducedMotion,
  springTransition,
} from "@kyomi/ui/lib/motion";
import { cn } from "@kyomi/ui/lib/utils";
import { useRef } from "react";
import { useHydrated } from "@hooks/use-hydrated";
import type { InboxFilter, InboxItem, InboxSort } from "@modules/articles/lib/api";
import type {
  ArticleDetailDto,
  InboxDensityDto,
  InboxTimestampDisplayDto,
} from "@kyomi/reader/schemas";
import {
  BackToInboxButton,
  DEFAULT_SORT,
  FilterControl,
  SearchBar,
  SortButton,
  type PinnedFolderFilter,
} from "./header";
import { BlurLayer } from "@modules/reader/components/detail/blur";
import { Toolbar as ReaderToolbar } from "@modules/reader/components/toolbar";
import { useReaderToolbar } from "@modules/reader/hooks/use-toolbar";

type ListDisplayOptions = {
  readerFocusMode?: boolean;
  showFavicons: boolean;
};

const EMPTY_STATE_BODY_COPY =
  "Follow feeds to start building your reading list. New stories will show up here as they're published.";

const EMPTY_PINNED_FOLDERS: PinnedFolderFilter[] = [];
const INBOX_LIST_SCROLL_RESTORATION_ID = "inbox-list";
const SCROLL_OFFSET_INHERIT = "[--scroll-area-overflow-y-start:inherit]";

function getEmptyStateCopy(filter: InboxFilter) {
  switch (filter) {
    case "my-feed":
      return {
        title: (
          <>
            Add a new feed or check out{" "}
            <Badge variant="secondary" size="lg">
              All
            </Badge>{" "}
            to get started
          </>
        ),
        description: EMPTY_STATE_BODY_COPY,
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
  onIntentItem?: (item: InboxItem) => void;
  onFilterChange?: (filter: InboxFilter) => void;
  onFolderFilterChange?: (folderId: string) => void;
  onBackToInbox?: () => void;
  onBackToList?: () => void;
  onSortChange: (sort: InboxSort) => void;
  sort?: InboxSort;
  isFeedScoped?: boolean;
  isArticleScoped?: boolean;
  activeFolderId?: string;
  feedLabel?: string;
  pinnedFolders?: PinnedFolderFilter[];
  selectedArticle?: ArticleDetailDto | null;
  showScrollbar?: boolean;
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
  onIntentItem,
  onFilterChange,
  onFolderFilterChange,
  onBackToInbox,
  onBackToList,
  onSortChange,
  sort,
  isFeedScoped = false,
  isArticleScoped = false,
  activeFolderId,
  feedLabel,
  pinnedFolders = EMPTY_PINNED_FOLDERS,
  selectedArticle,
  showScrollbar = true,
}: ListProps) {
  const { readerFocusMode = false, showFavicons } = display;
  const { isLoading, isRefreshing } = pagination;
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const listHeaderRef = useRef<HTMLDivElement | null>(null);
  const listToolsRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const scopeControlTransition = springTransition("standard", prefersReducedMotion);
  const controlSwap = controlSwapMotion(prefersReducedMotion);

  const { containerWidth: listContainerWidth, viewportHeight } = useViewport(listScrollRef, [
    inboxItems.length,
    isLoading,
    density,
    fontSizePx,
    readerFocusMode,
  ]);
  const isVirtualizerHostMounted = useHydrated();
  const scrollRestorationEntry = useElementScrollRestoration({
    id: INBOX_LIST_SCROLL_RESTORATION_ID,
  });

  const showEmptyState = isVirtualizerHostMounted && !isLoading && inboxItems.length === 0;
  const emptyState = getEmptyStateCopy(filter);
  const showScopedHeader = isArticleScoped || isFeedScoped;
  const backAction = isArticleScoped ? onBackToList : onBackToInbox;

  return (
    <section
      className="relative flex h-full max-h-full min-h-80 min-w-0 flex-col overflow-hidden md:min-h-0"
      aria-busy={isRefreshing || undefined}
      data-slot="inbox-list-root"
    >
      <ScrollAreaPrimitive.Root className="relative min-h-0 flex-1 overflow-hidden">
        <ScrollAreaPrimitive.Viewport
          ref={listScrollRef}
          className="h-full overflow-x-hidden outline-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden data-has-overflow-y:overscroll-y-contain"
          data-scroll-restoration-id={INBOX_LIST_SCROLL_RESTORATION_ID}
          data-slot="scroll-area-viewport"
        >
          <div
            className={cn(
              "flex min-h-full flex-col",
              // Base UI registers this variable as non-inherited, so each level down to the blur
              // layer opts in to the viewport's value.
              SCROLL_OFFSET_INHERIT,
              showEmptyState && "h-full",
            )}
          >
            {onFilterChange && !showEmptyState ? (
              // Zero-height and sticky so the layer sits at the viewport top and inherits the
              // viewport's scroll variables; its opacity follows the scroll offset directly, so
              // it needs no timing or easing of its own.
              <div
                aria-hidden="true"
                className={cn("sticky top-0 z-10 h-0 shrink-0", SCROLL_OFFSET_INHERIT)}
              >
                <BlurLayer topOffset={0} />
              </div>
            ) : null}
            {onFilterChange ? (
              <div
                ref={listHeaderRef}
                className="isolate sticky top-0 z-20 flex shrink-0 items-center justify-between gap-2 px-5.5 py-4.5"
                data-slot="inbox-list-header"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <LazyMotion features={domAnimation}>
                    <m.div className="inline-flex shrink-0">
                      <AnimatePresence initial={false} mode="popLayout">
                        {showScopedHeader && backAction ? (
                          <m.div
                            key="scoped-header"
                            className="flex min-w-0 items-center gap-2"
                            {...controlSwap}
                            transition={scopeControlTransition}
                          >
                            <BackToInboxButton onClick={backAction} />
                            {isArticleScoped && selectedArticle && !isLoading ? (
                              <HeaderReaderToolbar item={selectedArticle} />
                            ) : feedLabel ? (
                              <span className="relative inline-flex h-11 min-w-0 max-w-72 items-center overflow-hidden rounded-full bg-muted-solid px-4 text-base font-medium text-muted-foreground *:relative">
                                <span className="truncate">{feedLabel}</span>
                              </span>
                            ) : null}
                          </m.div>
                        ) : (
                          <m.div
                            key="filter-tabs"
                            layout
                            {...controlSwap}
                            transition={scopeControlTransition}
                          >
                            <FilterControl
                              activeFolderId={activeFolderId}
                              filter={filter}
                              pinnedFolders={pinnedFolders}
                              onFilterChange={onFilterChange}
                              onFolderFilterChange={onFolderFilterChange}
                            />
                          </m.div>
                        )}
                      </AnimatePresence>
                    </m.div>
                  </LazyMotion>
                </div>
                <div className="flex min-w-0 flex-1 items-center justify-end">
                  <div
                    ref={listToolsRef}
                    className="flex min-w-0 max-w-full items-center justify-end gap-2"
                  >
                    <SearchBar />
                    <LazyMotion features={domAnimation}>
                      <AnimatePresence initial={false} mode="popLayout">
                        {!isArticleScoped ? (
                          <m.div
                            key="sort"
                            layout
                            initial={
                              prefersReducedMotion ? false : { opacity: 0, x: -8, scale: 0.96 }
                            }
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={
                              prefersReducedMotion ? undefined : { opacity: 0, x: -8, scale: 0.96 }
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
              </div>
            ) : null}
            <div className={showEmptyState ? "flex flex-1 flex-col" : ""}>
              {showEmptyState ? (
                <Empty className="w-full px-5.5" size="md">
                  <EmptyHeader>
                    <EmptyMedia variant="illustration">
                      <EmptyStateIcon size={176} />
                    </EmptyMedia>
                    <EmptyTitle>{emptyState.title}</EmptyTitle>
                    <EmptyDescription>{emptyState.description}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : !isVirtualizerHostMounted ? (
                inboxItems.length === 0 && !isLoading ? null : (
                  <SkeletonRows
                    density={density}
                    fontSizePx={fontSizePx}
                    showFavicons={showFavicons}
                    readerFocusMode={readerFocusMode}
                    viewportHeight={viewportHeight}
                  />
                )
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
                  onIntentItem={onIntentItem}
                  viewportHeight={viewportHeight}
                  initialScrollOffset={scrollRestorationEntry?.scrollY}
                />
              )}
            </div>
          </div>
        </ScrollAreaPrimitive.Viewport>
        {showScrollbar && (inboxItems.length > 0 || isLoading) ? (
          <ScrollBar
            aria-label="Inbox list scrollbar"
            className="z-50"
            orientation="vertical"
            placement="viewport"
          />
        ) : null}
      </ScrollAreaPrimitive.Root>
    </section>
  );
}

function HeaderReaderToolbar({ item }: { item: ArticleDetailDto }) {
  const toolbar = useReaderToolbar({ item });

  return (
    <div className="relative inline-flex h-11 min-w-0 max-w-96 items-center overflow-hidden rounded-full bg-muted-solid px-1.5 text-base font-medium text-muted-foreground *:relative">
      <ReaderToolbar {...toolbar.toolbarProps} />
    </div>
  );
}
