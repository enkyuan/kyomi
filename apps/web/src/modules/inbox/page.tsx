/* oxlint-disable max-lines */
"use client";

import { AppShell } from "@/app/app-shell";
import { Detail } from "@modules/reader/components/detail";
import { MIN_INBOX_LEFT_PERCENT, MIN_INBOX_RIGHT_PERCENT } from "./lib/layout";
import { MobileLayout, ReaderFocusDetailLayout, SplitLayout } from "./layouts";
import { useQuery } from "@tanstack/react-query";
import { List } from "./components/list";
import {
  InboxPreferencesBootstrapProvider,
  type InboxPreferences,
  dedupePagedInboxItemsById,
  useInboxItemStateMutation,
  useInboxPreferences,
  useInboxQueries,
} from "@modules/inbox/hooks/use-inbox-data";
import {
  useInboxRouteState,
  useMarkReadBehavior,
  useResponsiveReaderMode,
  useSplitPane,
} from "@modules/inbox/hooks/use-inbox-layout";
import { getInboxViewCount, type InboxItem } from "@modules/inbox/services/api";
import { useTimezone } from "@hooks/use-timezone";
import { useViewportMetrics } from "@hooks/use-viewport-metrics";
import { QUERY_TIMES } from "@lib/query/policies";
import { writeShellStateSnapshot } from "@lib/shell/state";
import { deriveInboxListHeaderCount } from "@modules/inbox/utils/count-display";
import { inboxViewCountQueryKey } from "@modules/inbox/queries/options";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function Page({
  initialInboxPreferences,
  initialSplitPanePercent,
}: {
  initialInboxPreferences?: InboxPreferences;
  initialSplitPanePercent?: number;
}) {
  return (
    <InboxPreferencesBootstrapProvider initialPreferences={initialInboxPreferences}>
      <InboxPageContent
        initialInboxPreferences={initialInboxPreferences}
        initialSplitPanePercent={initialSplitPanePercent}
      />
    </InboxPreferencesBootstrapProvider>
  );
}

function InboxPageContent({
  initialInboxPreferences,
  initialSplitPanePercent,
}: {
  initialInboxPreferences?: InboxPreferences;
  initialSplitPanePercent?: number;
}) {
  const { preferences } = useInboxPreferences(initialInboxPreferences);
  const layoutContainerRef = useRef<HTMLDivElement | null>(null);
  const { containerWidth: layoutContainerWidth } = useViewportMetrics(layoutContainerRef);
  const layoutVariant = useResponsiveReaderMode(layoutContainerWidth);
  const isReaderFocusedLayout = layoutVariant === "reader-focused";
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
  } = route;

  const {
    containerRef: splitContainerRef,
    leftPanelPercent,
    isResizing,
    resizeHandleProps,
  } = useSplitPane({
    minLeftPercent: MIN_INBOX_LEFT_PERCENT,
    minRightPercent: MIN_INBOX_RIGHT_PERCENT,
    initialPercent:
      initialSplitPanePercent && Number.isFinite(initialSplitPanePercent)
        ? initialSplitPanePercent
        : 32,
  });

  const { inboxQuery, detailQuery } = useInboxQueries({
    filter: effectiveFilter,
    search,
    feedId,
    folderId,
    itemId,
    includeRead,
    timezoneOffsetMinutes,
  });

  const rawInboxItems = useMemo(
    () => dedupePagedInboxItemsById(inboxQuery.data?.pages),
    [inboxQuery.data?.pages],
  );

  const inboxItems = useMemo(() => {
    if (isReadScopedFilterActive) {
      return rawInboxItems.filter((item) => item.isRead);
    }
    return rawInboxItems;
  }, [isReadScopedFilterActive, rawInboxItems]);

  const viewCountQuery = useQuery({
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
        hasNextPage: !!inboxQuery.hasNextPage,
        viewCountQuery,
        includeRead,
        activeScopeLabel,
      }),
    [
      activeScopeLabel,
      effectiveFilter,
      includeRead,
      inboxItems.length,
      inboxQuery.hasNextPage,
      viewCountQuery,
    ],
  );

  const selectedItem = detailQuery.data?.item ?? null;

  const markReadMutation = useInboxItemStateMutation();

  const userDismissedTabletSelectionRef = useRef(false);

  const clearSelectedItem = useCallback(() => {
    setMobileTransitionDirection(-1);
    userDismissedTabletSelectionRef.current = true;
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
    void inboxQuery.fetchNextPage();
  }, [inboxQuery.fetchNextPage]);

  useMarkReadBehavior({
    itemId,
    selectedItem,
    effectiveFilter,
    markReadBehavior: preferences.inboxMarkReadBehavior,
    onMarkRead: (id) => {
      markReadMutation.mutate({ itemId: id, patch: { isRead: true } });
    },
  });

  useEffect(() => {
    userDismissedTabletSelectionRef.current = false;
  }, [effectiveFilter, feedId, folderId]);

  useEffect(() => {
    writeShellStateSnapshot({
      inboxFilter: effectiveFilter,
      inboxLayout: layoutVariant,
      selectedItemId: itemId ?? null,
    });
  }, [effectiveFilter, itemId, layoutVariant]);

  useEffect(() => {
    if (
      !isReaderFocusedLayout ||
      itemId ||
      inboxQuery.isPending ||
      inboxItems.length === 0 ||
      userDismissedTabletSelectionRef.current
    ) {
      return;
    }

    void navigate({
      search: (prev) => ({
        ...prev,
        itemId: inboxItems[0]?.id,
      }),
      replace: true,
    });
  }, [
    effectiveFilter,
    feedId,
    folderId,
    inboxItems,
    inboxQuery.isPending,
    isReaderFocusedLayout,
    itemId,
    navigate,
  ]);

  const listElement = (
    <InboxListSection
      effectiveFilter={effectiveFilter}
      feedId={feedId}
      folderId={folderId}
      itemId={itemId}
      showHiddenItems={showHiddenItems}
      showReadItems={showReadItems}
      preferences={preferences}
      inboxItems={inboxItems}
      headerCount={headerCount}
      inboxQuery={inboxQuery}
      isResizing={isResizing}
      fetchNextInboxPage={fetchNextInboxPage}
      selectItem={selectItem}
    />
  );

  const detailElementWithBack = (
    <InboxDetailSection
      preferences={preferences}
      detailQuery={detailQuery}
      selectedItem={selectedItem}
      showBackToList
      clearSelectedItem={clearSelectedItem}
    />
  );

  const detailElement = (
    <InboxDetailSection
      preferences={preferences}
      detailQuery={detailQuery}
      selectedItem={selectedItem}
    />
  );

  return (
    <AppShell readerFocusMode={isReaderFocusedLayout}>
      <div ref={layoutContainerRef} className="h-full max-h-full min-h-0 min-w-0">
        {layoutVariant === "reader-focused" ? (
          <ReaderFocusDetailLayout>{detailElementWithBack}</ReaderFocusDetailLayout>
        ) : layoutVariant === "stacked" ? (
          <MobileLayout
            showDetail={Boolean(itemId)}
            direction={mobileTransitionDirection}
            list={listElement}
            detail={detailElementWithBack}
          />
        ) : (
          <SplitLayout
            splitContainerRef={splitContainerRef}
            leftPanelPercent={leftPanelPercent}
            isResizing={isResizing}
            resizeHandleProps={resizeHandleProps}
            list={listElement}
            detail={detailElement}
          />
        )}
      </div>
    </AppShell>
  );
}

function InboxListSection({
  effectiveFilter,
  feedId,
  folderId,
  itemId,
  showHiddenItems,
  showReadItems,
  preferences,
  inboxItems,
  headerCount,
  inboxQuery,
  isResizing,
  fetchNextInboxPage,
  selectItem,
}: {
  effectiveFilter: ReturnType<typeof useInboxRouteState>["effectiveFilter"];
  feedId: string | undefined;
  folderId: string | undefined;
  itemId: string | undefined;
  showHiddenItems: boolean;
  showReadItems: boolean;
  preferences: InboxPreferences;
  inboxItems: InboxItem[];
  headerCount: ReturnType<typeof deriveInboxListHeaderCount>;
  inboxQuery: ReturnType<typeof useInboxQueries>["inboxQuery"];
  isResizing: boolean;
  fetchNextInboxPage: () => void;
  selectItem: (item: InboxItem) => void;
}) {
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
      feedId,
      folderId,
      pagination: {
        isLoading: inboxQuery.isPending && inboxItems.length === 0,
        isRefreshing:
          inboxQuery.isFetching && !inboxQuery.isFetchingNextPage && inboxItems.length > 0,
        hasNextPage: !!inboxQuery.hasNextPage,
        isFetchingNextPage: inboxQuery.isFetchingNextPage,
        fetchNextPage: fetchNextInboxPage,
      },
      onSelectItem: selectItem,
    }),
    [
      effectiveFilter,
      feedId,
      folderId,
      fetchNextInboxPage,
      headerCount,
      inboxItems,
      inboxQuery.isFetchingNextPage,
      inboxQuery.isFetching,
      inboxQuery.hasNextPage,
      inboxQuery.isPending,
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
    ],
  );

  return <List {...listProps} display={{ ...listProps.display, readerFocusMode: false }} />;
}

function InboxDetailSection({
  preferences,
  detailQuery,
  selectedItem,
  clearSelectedItem,
  showBackToList,
}: {
  preferences: InboxPreferences;
  detailQuery: ReturnType<typeof useInboxQueries>["detailQuery"];
  selectedItem:
    | NonNullable<ReturnType<typeof useInboxQueries>["detailQuery"]["data"]>["item"]
    | null;
  clearSelectedItem?: () => void;
  showBackToList?: boolean;
}) {
  const isDetailRefreshing = detailQuery.isFetching && Boolean(selectedItem);
  const isDetailLoading = detailQuery.isFetching && !selectedItem;
  const isDetailError = detailQuery.isError;

  const detailProps = useMemo(
    () => ({
      detailState: selectedItem
        ? ({ status: "selected", item: selectedItem, isRefreshing: isDetailRefreshing } as const)
        : isDetailLoading
          ? ({ status: "loading" } as const)
          : isDetailError
            ? ({ status: "error", error: detailQuery.error } as const)
            : ({ status: "empty" } as const),
      showFavicons: preferences.inboxShowFavicons,
      timestampDisplay: preferences.inboxTimestampDisplay,
      timestampHourCycle: preferences.inboxTimestampHourCycle,
    }),
    [
      detailQuery.error,
      isDetailError,
      isDetailLoading,
      isDetailRefreshing,
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
