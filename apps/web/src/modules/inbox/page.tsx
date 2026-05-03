"use client";

import { AppShell } from "@/app/app-shell";
import { dedupeInboxItems, useInboxQueries } from "@modules/inbox/use-queries";
import { useSplitPane } from "@hooks/use-split-pane";
import { InboxDetailView } from "@modules/inbox/detail-view";
import { InboxList } from "@modules/inbox/list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getInboxViewCount, updateInboxItemState, type InboxItem } from "@modules/inbox/api";
import { QUERY_TIMES } from "@lib/query-policies";
import { useInboxPreferences } from "@lib/inbox-preferences";
import { updateInboxItemCaches } from "@modules/inbox/cache";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { LayoutGroup, motion } from "motion/react";
import type { InboxPreferences } from "@lib/inbox-preferences";

const MIN_LEFT_PERCENT = 26;
const MIN_RIGHT_PERCENT = 64;
const INBOX_PANEL_SPACING_PX = 4;
const INBOX_PANEL_VERTICAL_PADDING_STYLE = {
  paddingBlock: `${INBOX_PANEL_SPACING_PX}px`,
} as const;
const INBOX_DETAIL_PANEL_OUTER_SPACING_STYLE = {
  paddingInlineEnd: `${INBOX_PANEL_SPACING_PX}px`,
} as const;

function parseSearchFlag(value: string | undefined) {
  if (!value) {
    return false;
  }
  const normalized = value.replaceAll('"', "");
  return normalized === "1" || normalized === "true";
}

export function InboxPage({
  initialInboxPreferences,
}: {
  initialInboxPreferences?: InboxPreferences;
}) {
  const { preferences } = useInboxPreferences(initialInboxPreferences);
  const queryClient = useQueryClient();
  const { filter, search, feedId, folderId, itemId, showHidden, showRead } = useSearch({
    from: "/inbox/",
  });
  const navigate = useNavigate({ from: "/inbox/" });
  const [timezoneOffsetMinutes, setTimezoneOffsetMinutes] = useState<number | undefined>(undefined);
  const delayedReadTimeoutRef = useRef<number | null>(null);
  const showHiddenItems = parseSearchFlag(showHidden);
  const showReadItems = parseSearchFlag(showRead);
  const effectiveFilter = filter ?? preferences.inboxDefaultView;
  const supportsReadScopedFilters = effectiveFilter === "today";
  const isReadScopedFilterActive = supportsReadScopedFilters && (showHiddenItems || showReadItems);
  const includeRead = isReadScopedFilterActive;

  useEffect(() => {
    setTimezoneOffsetMinutes(new Date().getTimezoneOffset());
  }, []);

  useEffect(() => {
    if (filter !== undefined) {
      return;
    }
    void navigate({
      search: (prev) => ({
        ...prev,
        filter: preferences.inboxDefaultView,
      }),
      replace: true,
    });
  }, [filter, navigate, preferences.inboxDefaultView]);

  useEffect(() => {
    if (supportsReadScopedFilters || (!showHiddenItems && !showReadItems)) {
      return;
    }
    void navigate({
      search: (prev) => ({
        ...prev,
        showHidden: undefined,
        showRead: undefined,
      }),
      replace: true,
    });
  }, [navigate, showHiddenItems, showReadItems, supportsReadScopedFilters]);

  const {
    containerRef: splitContainerRef,
    leftPanelPercent,
    setIsResizing,
  } = useSplitPane({
    minLeftPercent: MIN_LEFT_PERCENT,
    minRightPercent: MIN_RIGHT_PERCENT,
    initialPercent: 32,
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
    () => dedupeInboxItems(inboxQuery.data?.pages.flatMap((page) => page.items) ?? []),
    [inboxQuery.data?.pages],
  );
  const activeScopeLabel = isReadScopedFilterActive
    ? showHiddenItems && !showReadItems
      ? "hidden"
      : "read"
    : undefined;
  const inboxItems = useMemo(() => {
    if (isReadScopedFilterActive) {
      return rawInboxItems.filter((item) => item.isRead);
    }
    return rawInboxItems;
  }, [isReadScopedFilterActive, rawInboxItems]);

  const viewCountQuery = useQuery({
    queryKey: [
      "inbox",
      "view-count",
      effectiveFilter,
      feedId,
      folderId,
      timezoneOffsetMinutes,
      includeRead,
    ],
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
  const viewCount = viewCountQuery.data?.count ?? inboxItems.length;

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

  const clearSelectedItem = useCallback(() => {
    void navigate({
      search: (prev) => ({
        ...prev,
        itemId: undefined,
      }),
    });
  }, [navigate]);

  const selectItem = useCallback(
    (item: InboxItem) => {
      if (preferences.articleOpenBehavior === "original") {
        void navigate({
          search: (prev) => ({
            ...prev,
            itemId: undefined,
          }),
          replace: true,
        });
        window.open(item.link, "_blank", "noopener,noreferrer");
        if (!item.isRead && effectiveFilter !== "recent" && preferences.inboxMarkReadBehavior !== "manual") {
          markReadMutation.mutate(item.id);
        }
        return;
      }

      void navigate({
        search: (prev) => ({
          ...prev,
          itemId: item.id,
        }),
      });
    },
    [effectiveFilter, markReadMutation, navigate, preferences.articleOpenBehavior, preferences.inboxMarkReadBehavior],
  );

  useEffect(() => {
    if (delayedReadTimeoutRef.current !== null) {
      window.clearTimeout(delayedReadTimeoutRef.current);
      delayedReadTimeoutRef.current = null;
    }

    if (
      !itemId ||
      !selectedItem ||
      selectedItem.isRead ||
      effectiveFilter === "recent" ||
      preferences.inboxMarkReadBehavior === "manual"
    ) {
      return;
    }

    if (preferences.inboxMarkReadBehavior === "on-open") {
      markReadMutation.mutate(itemId);
      return;
    }

    delayedReadTimeoutRef.current = window.setTimeout(() => {
      markReadMutation.mutate(itemId);
      delayedReadTimeoutRef.current = null;
    }, 1500);

    return () => {
      if (delayedReadTimeoutRef.current !== null) {
        window.clearTimeout(delayedReadTimeoutRef.current);
        delayedReadTimeoutRef.current = null;
      }
    };
  }, [
    effectiveFilter,
    itemId,
    markReadMutation,
    preferences.inboxMarkReadBehavior,
    selectedItem,
  ]);

  const isReaderFocusMode = preferences.articleOpenBehavior === "reader";
  const isReaderFocus = isReaderFocusMode && Boolean(itemId);
  const isReaderFocusList = isReaderFocusMode && !itemId;
  const showReaderFocusEmptyState =
    isReaderFocusList && !inboxQuery.isPending && inboxItems.length === 0;

  return (
    <AppShell readerFocusList={isReaderFocusMode}>
      <LayoutGroup id="inbox-layout">
        {isReaderFocus ? (
          <motion.div
            data-reader-focus-list
            className="flex h-full max-h-full min-h-0 w-full min-w-0 items-stretch justify-center overflow-hidden"
            style={INBOX_PANEL_VERTICAL_PADDING_STYLE}
            layout
          >
            <motion.div
              className="h-full min-h-0 w-full min-w-0"
              layout
              layoutId="inbox-detail-panel"
            >
              <InboxDetailView
                selectedItem={selectedItem}
                isDetailLoading={isDetailLoading}
                isDetailError={isDetailError}
                detailError={detailQuery.error}
                showFavicons={preferences.inboxShowFavicons}
                timestampDisplay={preferences.inboxTimestampDisplay}
                timestampHourCycle={preferences.inboxTimestampHourCycle}
                showBackToList
                onBackToList={clearSelectedItem}
              />
            </motion.div>
          </motion.div>
        ) : isReaderFocusList ? (
          <motion.div
            data-reader-focus-list
            className="flex h-full max-h-full min-h-0 w-full min-w-0 items-stretch justify-center overflow-hidden"
            style={INBOX_PANEL_VERTICAL_PADDING_STYLE}
            layout
          >
            <motion.div
              className="h-full min-h-0 w-full min-w-0"
              layout
              layoutId="inbox-list-panel"
            >
              {showReaderFocusEmptyState ? (
                <InboxDetailView
                  selectedItem={null}
                  isDetailLoading={false}
                  isDetailError={false}
                  detailError={null}
                  showFavicons={preferences.inboxShowFavicons}
                  timestampDisplay={preferences.inboxTimestampDisplay}
                  timestampHourCycle={preferences.inboxTimestampHourCycle}
                />
              ) : (
                <InboxList
                  inboxItems={inboxItems}
                  viewCount={viewCount}
                  filter={effectiveFilter}
                  density={preferences.inboxDensity}
                  fontSizePx={preferences.inboxFontSizePx}
                  showFavicons={preferences.inboxShowFavicons}
                  timestampDisplay={preferences.inboxTimestampDisplay}
                  timestampHourCycle={preferences.inboxTimestampHourCycle}
                  activeScopeLabel={activeScopeLabel}
                  selectedItemId={itemId}
                  feedId={feedId}
                  showHidden={showHiddenItems}
                  showRead={showReadItems}
                  isLoading={inboxQuery.isPending}
                  hasNextPage={!!inboxQuery.hasNextPage}
                  isFetchingNextPage={inboxQuery.isFetchingNextPage}
                  fetchNextPage={() => inboxQuery.fetchNextPage()}
                  onSelectItem={selectItem}
                />
              )}
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            ref={splitContainerRef}
            className="grid h-full max-h-full min-h-0 min-w-0 flex-1 gap-0 overflow-hidden"
            style={{
              ...INBOX_PANEL_VERTICAL_PADDING_STYLE,
              gridTemplateColumns: `${leftPanelPercent}% ${INBOX_PANEL_SPACING_PX}px minmax(0, 1fr)`,
            }}
            layout
          >
            <motion.div className="h-full min-h-0 min-w-0" layout layoutId="inbox-list-panel">
              <InboxList
                inboxItems={inboxItems}
                viewCount={viewCount}
                filter={effectiveFilter}
                density={preferences.inboxDensity}
                fontSizePx={preferences.inboxFontSizePx}
                showFavicons={preferences.inboxShowFavicons}
                timestampDisplay={preferences.inboxTimestampDisplay}
                timestampHourCycle={preferences.inboxTimestampHourCycle}
                activeScopeLabel={activeScopeLabel}
                selectedItemId={itemId}
                feedId={feedId}
                showHidden={showHiddenItems}
                showRead={showReadItems}
                isLoading={inboxQuery.isPending}
                hasNextPage={!!inboxQuery.hasNextPage}
                isFetchingNextPage={inboxQuery.isFetchingNextPage}
                fetchNextPage={() => inboxQuery.fetchNextPage()}
                onSelectItem={selectItem}
              />
            </motion.div>

            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize panels"
              className="group flex h-full cursor-col-resize items-stretch justify-center"
              onPointerDown={(event) => {
                event.preventDefault();
                setIsResizing(true);
              }}
            >
              <div className="h-full w-px bg-transparent" />
            </div>

            <motion.div
              className="h-full min-h-0 min-w-0"
              style={INBOX_DETAIL_PANEL_OUTER_SPACING_STYLE}
              layout
              layoutId="inbox-detail-panel"
            >
              <InboxDetailView
                selectedItem={selectedItem}
                isDetailLoading={isDetailLoading}
                isDetailError={isDetailError}
                detailError={detailQuery.error}
                showFavicons={preferences.inboxShowFavicons}
                timestampDisplay={preferences.inboxTimestampDisplay}
                timestampHourCycle={preferences.inboxTimestampHourCycle}
              />
            </motion.div>
          </motion.div>
        )}
      </LayoutGroup>
    </AppShell>
  );
}
