"use client";

import { AppShell } from "@/app/app-shell";
import { Detail } from "@modules/reader/components/detail";
import { MIN_INBOX_LEFT_PERCENT, MIN_INBOX_RIGHT_PERCENT } from "../../lib/constants";
import { MobileSingleColumnLayout, ReaderFocusDetailLayout, SplitLayout } from "../layout";
import { useQuery } from "@tanstack/react-query";
import { List } from "../list";
import {
  InboxPreferencesBootstrapProvider,
  useInboxPreferences,
  type InboxPreferences,
} from "@modules/inbox/hooks/use-inbox-preferences";
import { dedupePagedInboxItemsById, useInboxQueries } from "@modules/inbox/hooks/use-inbox-queries";
import { useInboxItemStateMutation } from "@modules/inbox/hooks/use-inbox-item-state-mutation";
import { useInboxRouteState } from "@modules/inbox/hooks/use-route-state";
import { useMarkReadBehavior } from "@modules/inbox/hooks/use-mark-read-behavior";
import { useResponsiveReaderMode } from "@modules/inbox/hooks/use-responsive-reader-mode";
import { useSplitPane } from "@modules/inbox/hooks/use-split-pane";
import { getInboxViewCount, type InboxItem } from "@modules/inbox/services/api";
import { useTimezone } from "@hooks/use-timezone";
import { useViewportMetrics } from "@hooks/use-viewport-metrics";
import { QUERY_TIMES } from "@lib/query-policies";
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
    setIsResizing,
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
  const isDetailLoading = detailQuery.isFetching;
  const isDetailError = detailQuery.isError;

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
        isLoading: inboxQuery.isPending,
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

  const detailProps = useMemo(
    () => ({
      detailState: selectedItem
        ? ({ status: "selected", item: selectedItem } as const)
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
      preferences.inboxShowFavicons,
      preferences.inboxTimestampDisplay,
      preferences.inboxTimestampHourCycle,
      selectedItem,
    ],
  );

  return (
    <AppShell readerFocusMode={isReaderFocusedLayout}>
      <div ref={layoutContainerRef} className="h-full max-h-full min-h-0 min-w-0">
        {layoutVariant === "reader-focused" ? (
          <ReaderFocusDetailLayout>
            <Detail {...detailProps} showBackToList onBackToList={clearSelectedItem} />
          </ReaderFocusDetailLayout>
        ) : layoutVariant === "stacked" ? (
          <MobileSingleColumnLayout
            showDetail={Boolean(itemId)}
            direction={mobileTransitionDirection}
            list={
              <List {...listProps} display={{ ...listProps.display, readerFocusMode: false }} />
            }
            detail={<Detail {...detailProps} showBackToList onBackToList={clearSelectedItem} />}
          />
        ) : (
          <SplitLayout
            splitContainerRef={splitContainerRef}
            leftPanelPercent={leftPanelPercent}
            isResizing={isResizing}
            setIsResizing={setIsResizing}
            list={
              <List {...listProps} display={{ ...listProps.display, readerFocusMode: false }} />
            }
            detail={<Detail {...detailProps} />}
          />
        )}
      </div>
    </AppShell>
  );
}
