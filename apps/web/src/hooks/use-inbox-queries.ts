"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getInboxItemDetail, getInboxItems, type InboxFilter } from "@lib/inbox-functions";

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
  const inboxQuery = useInfiniteQuery({
    queryKey: ["inbox", "items", filter, search, feedId, folderId, timezoneOffsetMinutes],
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

  return { inboxQuery, detailQuery };
}
