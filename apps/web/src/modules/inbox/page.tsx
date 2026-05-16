"use client";

import { AppShell } from "@/app/app-shell";
import { useSplitPane } from "@hooks/use-split-pane";
import { InboxDetailView } from "@modules/inbox/components/detail-view";
import { InboxList } from "@modules/inbox/components/list";
import {
  MIN_INBOX_LEFT_PERCENT,
  MIN_INBOX_RIGHT_PERCENT,
} from "@modules/inbox/components/inbox-layout-constants";
import {
  InboxReaderFocusDetailLayout,
  InboxSplitLayout,
} from "@modules/inbox/components/inbox-layouts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getInboxViewCount, updateInboxItemState, type InboxItem } from "@modules/inbox/api";
import { QUERY_TIMES } from "@lib/query-policies";
import { InboxPreferencesBootstrapProvider, useInboxPreferences } from "@lib/inbox-preferences";
import { getTimezoneOffsetMinutes } from "@lib/query-policies";
import { updateInboxItemCaches } from "@modules/inbox/lib/cache";
import { deriveInboxListHeaderCount } from "@modules/inbox/lib/count-display";
import { inboxViewCountQueryKey } from "@modules/inbox/lib/query-options";
import { dedupePagedInboxItemsById, useInboxQueries } from "@hooks/use-inbox-queries";
import { useInboxRouteState } from "@modules/inbox/use-route-state";
import { useMarkReadBehavior } from "@modules/inbox/use-mark-read-behavior";
import { useMediaQuery } from "@hooks/use-media-query";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { InboxPreferences } from "@lib/inbox-preferences";

type InboxLayoutMode = "split" | "reader-detail";

function resolveInboxLayoutMode(isTabletViewport: boolean): InboxLayoutMode {
  return isTabletViewport ? "reader-detail" : "split";
}

export function InboxPage({
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
  const isTabletViewport = useMediaQuery({ min: "md", max: "lg" });
  const queryClient = useQueryClient();
  const timezoneOffsetMinutes = getTimezoneOffsetMinutes();

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

  const markReadMutation = useMutation({
    mutationFn: (selectedInboxItemId: string) =>
      updateInboxItemState({
        data: {
          itemId: selectedInboxItemId,
          isRead: true,
        },
      }),
    onMutate: async (selectedInboxItemId) => {
      await queryClient.cancelQueries({ queryKey: ["inbox"] });
      updateInboxItemCaches(queryClient, selectedInboxItemId, { isRead: true }, false);
    },
    onSettled: (_data, _error, selectedInboxItemId) => {
      void queryClient.invalidateQueries({ queryKey: ["inbox", "items"] });
      void queryClient.invalidateQueries({ queryKey: ["inbox", "view-count"] });
      void queryClient.invalidateQueries({
        queryKey: ["inbox", "item-detail", selectedInboxItemId],
      });
      void queryClient.invalidateQueries({ queryKey: ["sidebar", "inbox-summary"] });
    },
  });

  const userDismissedTabletSelectionRef = useRef(false);

  const clearSelectedItem = useCallback(() => {
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
  }, [inboxQuery]);

  useMarkReadBehavior({
    itemId,
    selectedItem,
    effectiveFilter,
    markReadBehavior: preferences.inboxMarkReadBehavior,
    onMarkRead: (id) => {
      markReadMutation.mutate(id);
    },
  });

  const layoutMode = resolveInboxLayoutMode(isTabletViewport);
  const isReaderFocusMode = layoutMode === "reader-detail";

  useEffect(() => {
    userDismissedTabletSelectionRef.current = false;
  }, [effectiveFilter, feedId, folderId]);

  useEffect(() => {
    if (
      !isTabletViewport ||
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
    isTabletViewport,
    itemId,
    navigate,
  ]);

  const listProps = useMemo(
    () => ({
      inboxItems,
      headerCount,
      filter: effectiveFilter,
      density: preferences.inboxDensity,
      fontSizePx: preferences.inboxFontSizePx,
      showFavicons: preferences.inboxShowFavicons,
      timestampDisplay: preferences.inboxTimestampDisplay,
      timestampHourCycle: preferences.inboxTimestampHourCycle,
      selectedItemId: itemId,
      feedId,
      folderId,
      showHidden: showHiddenItems,
      showRead: showReadItems,
      disableVirtualization: isResizing,
      isLoading: inboxQuery.isPending,
      hasNextPage: !!inboxQuery.hasNextPage,
      isFetchingNextPage: inboxQuery.isFetchingNextPage,
      fetchNextPage: fetchNextInboxPage,
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
      selectedItem,
      isDetailLoading,
      isDetailError,
      detailError: detailQuery.error,
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
    <AppShell readerFocusMode={isReaderFocusMode}>
      {isReaderFocusMode ? (
        <InboxReaderFocusDetailLayout>
          <InboxDetailView {...detailProps} showBackToList onBackToList={clearSelectedItem} />
        </InboxReaderFocusDetailLayout>
      ) : (
        <InboxSplitLayout
          splitContainerRef={splitContainerRef}
          leftPanelPercent={leftPanelPercent}
          isResizing={isResizing}
          setIsResizing={setIsResizing}
          list={<InboxList {...listProps} readerFocusMode={false} />}
          detail={<InboxDetailView {...detailProps} />}
        />
      )}
    </AppShell>
  );
}
