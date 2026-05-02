import type { QueryClient } from "@tanstack/react-query";
import { getInboxItemDetail, getInboxItems, getSidebarInboxCounts } from "./api";
import type { InboxFilter } from "./api";
import { getTimezoneOffsetMinutes, QUERY_TIMES } from "@lib/query-policies";

export type InboxQueryScope = {
  filter?: InboxFilter;
  search?: string;
  feedId?: string;
  folderId?: string;
  itemId?: string;
  timezoneOffsetMinutes?: number;
};

export function inboxItemsQueryKey({
  filter = "today",
  search,
  feedId,
  folderId,
  timezoneOffsetMinutes = getTimezoneOffsetMinutes(),
}: InboxQueryScope = {}) {
  return ["inbox", "items", filter, search, feedId, folderId, timezoneOffsetMinutes] as const;
}

export function inboxDetailQueryKey(itemId: string | undefined) {
  return ["inbox", "item-detail", itemId] as const;
}

export function sidebarInboxSummaryQueryKey(timezoneOffsetMinutes = getTimezoneOffsetMinutes()) {
  return ["sidebar", "inbox-summary", "global", timezoneOffsetMinutes] as const;
}

export function inboxItemsInfiniteQueryOptions(scope: InboxQueryScope = {}) {
  const filter = scope.filter ?? "today";
  const timezoneOffsetMinutes = scope.timezoneOffsetMinutes ?? getTimezoneOffsetMinutes();

  return {
    queryKey: inboxItemsQueryKey({ ...scope, filter, timezoneOffsetMinutes }),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      getInboxItems({
        data: {
          filter,
          search: scope.search,
          feedId: scope.feedId,
          folderId: scope.folderId,
          cursor: pageParam,
          timezoneOffsetMinutes,
        },
      }),
    getNextPageParam: (lastPage: Awaited<ReturnType<typeof getInboxItems>>) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
    staleTime: QUERY_TIMES.listStale,
    gcTime: QUERY_TIMES.listGc,
  };
}

export function inboxDetailQueryOptions(itemId: string | undefined) {
  return {
    queryKey: inboxDetailQueryKey(itemId),
    enabled: Boolean(itemId),
    retry: 1,
    queryFn: () => {
      if (!itemId) {
        throw new Error("Missing inbox item id");
      }
      return getInboxItemDetail({
        data: {
          itemId,
        },
      });
    },
    staleTime: QUERY_TIMES.detailStale,
    gcTime: QUERY_TIMES.detailGc,
  };
}

export function sidebarInboxSummaryQueryOptions(
  timezoneOffsetMinutes: number | undefined = getTimezoneOffsetMinutes(),
) {
  return {
    queryKey: sidebarInboxSummaryQueryKey(timezoneOffsetMinutes),
    enabled: timezoneOffsetMinutes !== undefined,
    queryFn: () =>
      getSidebarInboxCounts({
        data: { timezoneOffsetMinutes },
      }),
    staleTime: QUERY_TIMES.countsStale,
    gcTime: QUERY_TIMES.countsGc,
    refetchOnWindowFocus: true,
  };
}

export async function prefetchInboxHotQueries(
  queryClient: QueryClient,
  scope: InboxQueryScope = {},
) {
  const timezoneOffsetMinutes = scope.timezoneOffsetMinutes ?? getTimezoneOffsetMinutes();

  await Promise.all([
    queryClient.prefetchInfiniteQuery(
      inboxItemsInfiniteQueryOptions({ ...scope, timezoneOffsetMinutes }),
    ),
    queryClient.prefetchQuery(sidebarInboxSummaryQueryOptions(timezoneOffsetMinutes)),
    scope.itemId
      ? queryClient.prefetchQuery(inboxDetailQueryOptions(scope.itemId))
      : Promise.resolve(),
  ]);
}
