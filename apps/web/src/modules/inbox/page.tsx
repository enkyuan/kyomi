"use client";

import { AppShell } from "@/app/app-shell";
import { dedupeInboxItems, useInboxQueries } from "@modules/inbox/use-queries";
import { useSplitPane } from "@hooks/use-split-pane";
import { InboxDetailView } from "@modules/inbox/detail-view";
import { InboxList } from "@modules/inbox/list";
import { useQuery } from "@tanstack/react-query";
import { getInboxViewCount } from "@modules/inbox/api";
import { QUERY_TIMES } from "@lib/query-policies";

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";

const MIN_LEFT_PERCENT = 26;
const MIN_RIGHT_PERCENT = 64;

function parseSearchFlag(value: string | undefined) {
  if (!value) {
    return false;
  }
  const normalized = value.replaceAll('"', "");
  return normalized === "1" || normalized === "true";
}

export function InboxPage() {
  const {
    filter = "today",
    search,
    feedId,
    folderId,
    itemId,
    showHidden,
    showRead,
  } = useSearch({ from: "/inbox/" });
  const navigate = useNavigate({ from: "/inbox/" });
  const [timezoneOffsetMinutes, setTimezoneOffsetMinutes] = useState<number | undefined>(undefined);
  const showHiddenItems = parseSearchFlag(showHidden);
  const showReadItems = parseSearchFlag(showRead);
  const supportsReadScopedFilters = filter === "today";
  const isReadScopedFilterActive = supportsReadScopedFilters && (showHiddenItems || showReadItems);
  const includeRead = isReadScopedFilterActive;

  useEffect(() => {
    setTimezoneOffsetMinutes(new Date().getTimezoneOffset());
  }, []);

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
    filter: filter ?? "today",
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
    if (filter === "saved") {
      return rawInboxItems.filter((item) => !item.isRead);
    }
    if (isReadScopedFilterActive) {
      return rawInboxItems.filter((item) => item.isRead);
    }
    return rawInboxItems;
  }, [filter, isReadScopedFilterActive, rawInboxItems]);

  const viewCountQuery = useQuery({
    queryKey: ["inbox", "view-count", filter, feedId, folderId, timezoneOffsetMinutes, includeRead],
    enabled: timezoneOffsetMinutes !== undefined && !includeRead,
    queryFn: () =>
      getInboxViewCount({
        data: {
          filter,
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
  return (
    <AppShell>
      <div
        ref={splitContainerRef}
        className="grid h-full max-h-full min-h-0 min-w-0 flex-1 gap-0 overflow-hidden"
        style={{
          gridTemplateColumns: `${leftPanelPercent}% 4px minmax(0, 1fr)`,
        }}
      >
        <InboxList
          inboxItems={inboxItems}
          viewCount={viewCount}
          filter={filter}
          activeScopeLabel={activeScopeLabel}
          selectedItemId={itemId}
          feedId={feedId}
          showHidden={showHiddenItems}
          showRead={showReadItems}
          isLoading={inboxQuery.isPending}
          hasNextPage={!!inboxQuery.hasNextPage}
          isFetchingNextPage={inboxQuery.isFetchingNextPage}
          fetchNextPage={() => inboxQuery.fetchNextPage()}
        />

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

        <InboxDetailView
          selectedItem={selectedItem}
          isDetailLoading={isDetailLoading}
          isDetailError={isDetailError}
          detailError={detailQuery.error}
        />
      </div>
    </AppShell>
  );
}
