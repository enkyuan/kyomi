"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getInboxItemDetail, getInboxItems, type InboxFilter } from "@lib/inbox-functions";

export const AUTO_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
export const AUTO_REFRESH_INDICATOR_VISIBLE_MS = Math.min(8_000, AUTO_REFRESH_INTERVAL_MS);

type UseInboxQueriesInput = {
  filter: InboxFilter;
  search?: string;
  feedId?: string;
  folderId?: string;
  selectedItemId?: string;
  timezoneOffsetMinutes?: number;
};

export function dedupeInboxItems(items: Awaited<ReturnType<typeof getInboxItems>>["items"]) {
  const unique = new Map<string, (typeof items)[number]>();
  for (const item of items) {
    if (!unique.has(item.id)) {
      unique.set(item.id, item);
    }
  }
  return [...unique.values()];
}

export function useInboxQueries({
  filter,
  search,
  feedId,
  folderId,
  selectedItemId,
  timezoneOffsetMinutes,
}: UseInboxQueriesInput) {
  const shouldAutoRefresh = filter === "today" || filter === "unread";
  const isTimezoneReadyForToday = filter !== "today" || timezoneOffsetMinutes !== undefined;

  const inboxQuery = useInfiniteQuery({
    queryKey: ["inbox", "items", filter, search, feedId, folderId, timezoneOffsetMinutes],
    enabled: isTimezoneReadyForToday,
    refetchOnMount: shouldAutoRefresh ? false : true,
    refetchOnWindowFocus: shouldAutoRefresh ? false : true,
    refetchOnReconnect: shouldAutoRefresh ? false : true,
    refetchIntervalInBackground: shouldAutoRefresh,
    refetchInterval: shouldAutoRefresh ? AUTO_REFRESH_INTERVAL_MS : false,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      getInboxItems({
        data: {
          filter,
          search,
          feedId,
          folderId,
          cursor: pageParam,
          timezoneOffsetMinutes,
        },
      }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
  });

  const detailQuery = useQuery({
    queryKey: ["inbox", "item-detail", selectedItemId],
    enabled: Boolean(selectedItemId),
    retry: 1,
    queryFn: () => {
      if (!selectedItemId) {
        throw new Error("Missing inbox item id");
      }
      return getInboxItemDetail({
        data: {
          itemId: selectedItemId,
        },
      });
    },
  });

  return { inboxQuery, detailQuery, isAutoRefreshEnabled: shouldAutoRefresh };
}
