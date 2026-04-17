"use client";

import { dedupeInboxItems, useInboxQueries } from "@hooks/use-inbox-queries";
import { useSplitPane } from "@hooks/use-split-pane";
import { InboxList } from "@components/pages/inbox/inbox-list";
import { InboxDetailView } from "@components/pages/inbox/inbox-detail-view";

import { useEffect, useMemo, useState } from "react";
import { Route } from "@/routes/inbox/index";
import { AppShell } from "@pages/app-shell";

const MIN_LEFT_PERCENT = 26;
const MIN_RIGHT_PERCENT = 64;

export function InboxPage() {
  const { filter = "today", search, feedId, folderId, itemId } = Route.useSearch();
  const selectedItemId = itemId;
  const [timezoneOffsetMinutes, setTimezoneOffsetMinutes] = useState<number | undefined>(undefined);

  useEffect(() => {
    setTimezoneOffsetMinutes(new Date().getTimezoneOffset());
  }, []);

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
    selectedItemId,
    timezoneOffsetMinutes,
  });

  const inboxItems = useMemo(
    () => dedupeInboxItems(inboxQuery.data?.pages.flatMap((page) => page.items) ?? []),
    [inboxQuery.data?.pages],
  );

  const unreadCount = useMemo(
    () => inboxItems.reduce((count, item) => count + (item.isRead ? 0 : 1), 0),
    [inboxItems],
  );

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
          unreadCount={unreadCount}
          selectedItemId={selectedItemId}
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
