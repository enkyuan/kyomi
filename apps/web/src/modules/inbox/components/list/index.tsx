"use client";

import { useViewport } from "@modules/inbox/hooks/use-viewport";
import { type RowsPaginationState } from "./rows";
import { ScrollAreaPrimitive, ScrollBar } from "@kyomi/ui/components/scroll-area";
import { useElementScrollRestoration } from "@tanstack/react-router";
import { cn } from "@kyomi/ui/lib/utils";
import { useRef } from "react";
import { useHydrated } from "@hooks/use-hydrated";
import type { InboxFilter, InboxItem, InboxSort } from "@modules/articles/lib/api";
import type {
  ArticleDetailDto,
  InboxDensityDto,
  InboxTimestampDisplayDto,
} from "@kyomi/reader/schemas";
import { type PinnedFolderFilter } from "./header";
import { ListBody } from "./body";
import { ListHeader } from "./scope-bar";

type ListDisplayOptions = {
  readerFocusMode?: boolean;
  showFavicons: boolean;
};

const EMPTY_PINNED_FOLDERS: PinnedFolderFilter[] = [];
const INBOX_LIST_SCROLL_RESTORATION_ID = "inbox-list";

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
          <div className={cn("flex min-h-full flex-col", showEmptyState && "h-full")}>
            {onFilterChange ? (
              <ListHeader
                activeFolderId={activeFolderId}
                backAction={backAction}
                feedLabel={feedLabel}
                filter={filter}
                isArticleScoped={isArticleScoped}
                isLoading={isLoading}
                pinnedFolders={pinnedFolders}
                selectedArticle={selectedArticle}
                showScopedHeader={showScopedHeader}
                sort={sort}
                onFilterChange={onFilterChange}
                onFolderFilterChange={onFolderFilterChange}
                onSortChange={onSortChange}
              />
            ) : null}
            <ListBody
              density={density}
              filter={filter}
              fontSizePx={fontSizePx}
              inboxItems={inboxItems}
              initialScrollOffset={scrollRestorationEntry?.scrollY}
              isLoading={isLoading}
              isVirtualizerHostMounted={isVirtualizerHostMounted}
              listContainerWidth={listContainerWidth}
              listScrollRef={listScrollRef}
              pagination={pagination}
              readerFocusMode={readerFocusMode}
              selectedItemId={selectedItemId}
              showEmptyState={showEmptyState}
              showFavicons={showFavicons}
              timestampDisplay={timestampDisplay}
              timestampHourCycle={timestampHourCycle}
              viewportHeight={viewportHeight}
              onIntentItem={onIntentItem}
              onSelectItem={onSelectItem}
            />
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
