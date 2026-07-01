/* oxlint-disable max-lines */
"use client";

import { AppShell } from "@/app/app-shell";
import { Detail } from "@modules/reader/components/detail";
import { MobileLayout } from "./layouts/mobile";
import { useQuery } from "@tanstack/react-query";
import { List } from "./components/list";
import {
  InboxPreferencesBootstrapProvider,
  type InboxPreferences,
  dedupePagedInboxItemsById,
  useInboxPreferences,
  useInboxQueries,
} from "@modules/inbox/hooks/use-inbox-data";
import { useInboxRouteState, useResponsiveReaderMode } from "@modules/inbox/hooks/use-inbox-layout";
import { getInboxViewCount, type InboxFilter, type InboxItem } from "@modules/inbox/services/api";
import { useTimezone } from "@hooks/use-timezone";
import { useViewportMetrics } from "@hooks/use-viewport-metrics";
import { QUERY_TIMES } from "@lib/query/policies";
import { writeShellStateSnapshot } from "@lib/shell/state";
import { listFollowedFeeds } from "@modules/feeds/api";
import { deriveInboxListHeaderCount } from "@modules/inbox/utils/count-display";
import { followedFeedsQueryKey, inboxViewCountQueryKey } from "@modules/inbox/queries/options";
import type { ArticleDetailDto } from "@lib/schemas";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function isGlobalInboxFilter(filter: InboxFilter) {
  return filter === "all" || filter === "saved" || filter === "recent";
}

export function Page({
  initialInboxPreferences,
  initialSplitPanePercent: _initialSplitPanePercent,
}: {
  initialInboxPreferences?: InboxPreferences;
  initialSplitPanePercent?: number;
}) {
  return (
    <InboxPreferencesBootstrapProvider initialPreferences={initialInboxPreferences}>
      <InboxPageContent initialInboxPreferences={initialInboxPreferences} />
    </InboxPreferencesBootstrapProvider>
  );
}

function InboxPageContent({
  initialInboxPreferences,
}: {
  initialInboxPreferences?: InboxPreferences;
}) {
  const { preferences } = useInboxPreferences(initialInboxPreferences);
  const layoutContainerRef = useRef<HTMLDivElement | null>(null);
  const { containerWidth: layoutContainerWidth } = useViewportMetrics(layoutContainerRef);
  const layoutVariant = useResponsiveReaderMode(layoutContainerWidth);
  const [mobileTransitionDirection, setMobileTransitionDirection] = useState<1 | -1>(1);
  const timezoneOffsetMinutes = useTimezone();

  const route = useInboxRouteState(preferences);
  const {
    navigate,
    search,
    feedId,
    folderId,
    itemId,
    showHiddenItems,
    showReadItems,
    effectiveFilter,
    isReadScopedFilterActive,
    includeRead,
    activeScopeLabel,
    sort,
  } = route;

  const {
    detailData,
    detailError,
    fetchNextInboxPage: requestNextInboxPage,
    hasNextInboxPage,
    inboxData,
    inboxDataUpdatedAt,
    isDetailError,
    isDetailFetching,
    isInboxFetching,
    isInboxFetchingNextPage,
    isInboxPending,
  } = useInboxQueries({
    filter: effectiveFilter,
    search,
    feedId,
    folderId,
    itemId,
    includeRead,
    sort,
    timezoneOffsetMinutes,
  });
  const { isSuccess: isFollowedFeedsSuccess, data: followedFeedsData } = useQuery({
    queryKey: followedFeedsQueryKey(),
    queryFn: () => listFollowedFeeds(),
    staleTime: QUERY_TIMES.staticMetadataStale,
    gcTime: QUERY_TIMES.staticMetadataGc,
  });
  const hasNoFollowedFeeds = isFollowedFeedsSuccess && (followedFeedsData?.length ?? 0) === 0;
  const isFeedBackedListView =
    !search &&
    !feedId &&
    !folderId &&
    effectiveFilter !== "all" &&
    effectiveFilter !== "saved" &&
    effectiveFilter !== "recent";
  const hasKnownEmptyFeedBackedView = hasNoFollowedFeeds && isFeedBackedListView;

  const rawInboxItems = useMemo(
    () => dedupePagedInboxItemsById(inboxData?.pages),
    [inboxData?.pages],
  );

  const inboxItems = useMemo(() => {
    if (isReadScopedFilterActive) {
      return rawInboxItems.filter((item) => item.isRead);
    }
    return rawInboxItems;
  }, [isReadScopedFilterActive, rawInboxItems]);

  const { isSuccess: isViewCountSuccess, data: viewCountData } = useQuery({
    queryKey: inboxViewCountQueryKey({
      filter: effectiveFilter,
      feedId,
      folderId,
      timezoneOffsetMinutes,
      includeRead,
    }),
    enabled: timezoneOffsetMinutes !== undefined && !includeRead && effectiveFilter !== "recent",
    queryFn: () =>
      getInboxViewCount({
        data: {
          filter: effectiveFilter,
          feedId,
          folderId,
          timezoneOffsetMinutes,
          includeRead,
        },
      }),
    staleTime: QUERY_TIMES.countsStale,
    gcTime: QUERY_TIMES.countsGc,
  });

  const headerCount = useMemo(
    () =>
      deriveInboxListHeaderCount({
        filter: effectiveFilter,
        loadedCount: inboxItems.length,
        hasNextPage: !!hasNextInboxPage,
        viewCountQuery: { isSuccess: isViewCountSuccess, data: viewCountData },
        includeRead,
        activeScopeLabel,
      }),
    [
      activeScopeLabel,
      effectiveFilter,
      hasNextInboxPage,
      includeRead,
      inboxItems.length,
      isViewCountSuccess,
      viewCountData,
    ],
  );

  const selectedItem = detailData?.item ?? null;

  const clearSelectedItem = useCallback(() => {
    setMobileTransitionDirection(-1);
    void navigate({
      search: (prev) => ({
        ...prev,
        itemId: undefined,
      }),
    });
  }, [navigate]);

  const selectItem = useCallback(
    (item: InboxItem) => {
      setMobileTransitionDirection(1);
      void navigate({
        search: (prev) => ({
          ...prev,
          itemId: item.id,
        }),
      });
    },
    [navigate],
  );

  const fetchNextInboxPage = useCallback(() => {
    void requestNextInboxPage();
  }, [requestNextInboxPage]);

  useEffect(() => {
    writeShellStateSnapshot({
      inboxFilter: effectiveFilter,
      inboxLayout: layoutVariant,
      selectedItemId: itemId ?? null,
    });
  }, [effectiveFilter, itemId, layoutVariant]);

  const listElement = (
    <InboxListSection
      effectiveFilter={effectiveFilter}
      itemId={itemId}
      showHiddenItems={showHiddenItems}
      showReadItems={showReadItems}
      preferences={preferences}
      inboxItems={inboxItems}
      headerCount={headerCount}
      hasKnownEmptyFeedBackedView={hasKnownEmptyFeedBackedView}
      hasNextInboxPage={hasNextInboxPage}
      inboxDataUpdatedAt={inboxDataUpdatedAt}
      isInboxFetching={isInboxFetching}
      isInboxFetchingNextPage={isInboxFetchingNextPage}
      isInboxPending={isInboxPending}
      isResizing={false}
      fetchNextInboxPage={fetchNextInboxPage}
      selectItem={selectItem}
      navigate={navigate}
      sort={sort}
    />
  );

  const detailElementWithBack = useMemo(
    () => (
      <InboxDetailSection
        preferences={preferences}
        detailError={detailError}
        isDetailError={isDetailError}
        isDetailFetching={isDetailFetching}
        selectedItem={selectedItem}
        showBackToList
        clearSelectedItem={clearSelectedItem}
      />
    ),
    [clearSelectedItem, detailError, isDetailError, isDetailFetching, preferences, selectedItem],
  );

  return (
    <AppShell>
      <div ref={layoutContainerRef} className="h-full max-h-full min-h-0 min-w-0">
        {layoutVariant === "stacked" ? (
          <MobileLayout
            showDetail={Boolean(itemId)}
            direction={mobileTransitionDirection}
            list={listElement}
            detail={detailElementWithBack}
          />
        ) : (
          <div className="flex h-full max-h-full min-h-0 min-w-0 overflow-hidden pe-3">
            <div className="h-full min-h-0 min-w-0 flex-1">{listElement}</div>
            <aside className="hidden h-full w-96 shrink-0 flex-col pt-[18px] pb-4 xl:flex">
              <InboxSidebarCard />
            </aside>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function InboxSidebarCard() {
  return (
    <div className="h-full flex-1 rounded-2xl border border-border bg-card text-card-foreground shadow-sm/5" />
  );
}

// oxlint-disable-next-line react-doctor/no-many-boolean-props
function InboxListSection({
  effectiveFilter,
  itemId,
  showHiddenItems,
  showReadItems,
  preferences,
  inboxItems,
  headerCount,
  hasKnownEmptyFeedBackedView,
  hasNextInboxPage,
  inboxDataUpdatedAt,
  isInboxFetching,
  isInboxFetchingNextPage,
  isInboxPending,
  isResizing,
  fetchNextInboxPage,
  selectItem,
  navigate,
  sort,
}: {
  effectiveFilter: ReturnType<typeof useInboxRouteState>["effectiveFilter"];
  itemId: string | undefined;
  showHiddenItems: boolean;
  showReadItems: boolean;
  preferences: InboxPreferences;
  inboxItems: InboxItem[];
  headerCount: ReturnType<typeof deriveInboxListHeaderCount>;
  hasKnownEmptyFeedBackedView: boolean;
  hasNextInboxPage: boolean | undefined;
  inboxDataUpdatedAt: number;
  isInboxFetching: boolean;
  isInboxFetchingNextPage: boolean;
  isInboxPending: boolean;
  isResizing: boolean;
  fetchNextInboxPage: () => void;
  selectItem: (item: InboxItem) => void;
  navigate: ReturnType<typeof useInboxRouteState>["navigate"];
  sort: ReturnType<typeof useInboxRouteState>["sort"];
}) {
  const handleFilterChange = useCallback(
    (filter: InboxFilter) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          filter,
          feedId: isGlobalInboxFilter(filter) ? undefined : prev.feedId,
          folderId: isGlobalInboxFilter(filter) ? undefined : prev.folderId,
          itemId: undefined,
        }),
      });
    },
    [navigate],
  );

  const listProps = useMemo(
    () => ({
      inboxItems,
      headerCount,
      filter: effectiveFilter,
      display: {
        showFavicons: preferences.inboxShowFavicons,
        disableVirtualization: isResizing,
      },
      filterVisibility: {
        showHidden: showHiddenItems,
        showRead: showReadItems,
      },
      density: preferences.inboxDensity,
      fontSizePx: preferences.inboxFontSizePx,
      timestampDisplay: preferences.inboxTimestampDisplay,
      timestampHourCycle: preferences.inboxTimestampHourCycle,
      selectedItemId: itemId,
      pagination: {
        isLoading: !hasKnownEmptyFeedBackedView && isInboxPending && inboxItems.length === 0,
        isRefreshing: isInboxFetching && !isInboxFetchingNextPage && inboxItems.length > 0,
        hasNextPage: !!hasNextInboxPage,
        isFetchingNextPage: isInboxFetchingNextPage,
        fetchNextPage: fetchNextInboxPage,
        dataUpdatedAt: inboxDataUpdatedAt,
      },
      onSelectItem: selectItem,
      onFilterChange: handleFilterChange,
      sort,
    }),
    [
      effectiveFilter,
      fetchNextInboxPage,
      handleFilterChange,
      hasKnownEmptyFeedBackedView,
      headerCount,
      inboxItems,
      inboxDataUpdatedAt,
      isInboxFetchingNextPage,
      isInboxFetching,
      hasNextInboxPage,
      isInboxPending,
      isResizing,
      preferences.inboxDensity,
      preferences.inboxFontSizePx,
      preferences.inboxShowFavicons,
      preferences.inboxTimestampDisplay,
      preferences.inboxTimestampHourCycle,
      itemId,
      selectItem,
      showHiddenItems,
      showReadItems,
      sort,
    ],
  );

  return <List {...listProps} display={{ ...listProps.display, readerFocusMode: false }} />;
}

function InboxDetailSection({
  preferences,
  detailError,
  isDetailError,
  isDetailFetching,
  selectedItem,
  clearSelectedItem,
  showBackToList,
}: {
  preferences: InboxPreferences;
  detailError: unknown;
  isDetailError: boolean;
  isDetailFetching: boolean;
  selectedItem: ArticleDetailDto | null;
  clearSelectedItem?: () => void;
  showBackToList?: boolean;
}) {
  const isDetailLoading = isDetailFetching && !selectedItem;

  const detailProps = useMemo(
    () => ({
      detailState: selectedItem
        ? ({ status: "selected", item: selectedItem } as const)
        : isDetailLoading
          ? ({ status: "loading" } as const)
          : isDetailError
            ? ({ status: "error", error: detailError } as const)
            : ({ status: "empty" } as const),
      showFavicons: preferences.inboxShowFavicons,
      timestampDisplay: preferences.inboxTimestampDisplay,
      timestampHourCycle: preferences.inboxTimestampHourCycle,
    }),
    [
      detailError,
      isDetailError,
      isDetailLoading,
      preferences.inboxShowFavicons,
      preferences.inboxTimestampDisplay,
      preferences.inboxTimestampHourCycle,
      selectedItem,
    ],
  );

  return (
    <Detail {...detailProps} showBackToList={showBackToList} onBackToList={clearSelectedItem} />
  );
}
