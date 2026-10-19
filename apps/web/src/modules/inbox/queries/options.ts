import type { QueryClient } from "@tanstack/react-query";
import {
  getInboxItemDetail,
  getInboxItems,
  getSidebarInboxCounts,
  type InboxFilter,
  type InboxListPage,
  type InboxSort,
} from "@modules/articles/lib/api";
import { getInboxRecap } from "../lib/recap/api";
import { queryKeys } from "@lib/query/keys";
import { getTimezoneOffsetMinutes, QUERY_TIMES } from "@lib/query/policies";

const DEFAULT_INBOX_FILTER: InboxFilter = "my-feed";
const DEFAULT_INBOX_SORT: InboxSort = "latest";
const INBOX_LIST_QUERY_VERSION = 4;
export const ACTIVE_FEED_REFRESH_POLL_INTERVAL_MS = 2_500;
export const IDLE_FEED_REFRESH_POLL_INTERVAL_MS = 30_000;

export function hasActiveFeedRefresh(
  feeds: readonly { refreshStatus?: string | null }[] | null | undefined,
) {
  return (
    feeds?.some((feed) => feed.refreshStatus === "queued" || feed.refreshStatus === "running") ??
    false
  );
}

export function getFeedRefreshPollInterval(
  feeds: readonly { refreshStatus?: string | null }[] | null | undefined,
) {
  return hasActiveFeedRefresh(feeds)
    ? ACTIVE_FEED_REFRESH_POLL_INTERVAL_MS
    : IDLE_FEED_REFRESH_POLL_INTERVAL_MS;
}

function normalizeInboxListPage(page: unknown): InboxListPage | undefined {
  if (!page || typeof page !== "object") {
    return undefined;
  }

  const candidate = page as Partial<InboxListPage>;
  if (!Array.isArray(candidate.items)) {
    return undefined;
  }

  const nextCursor = candidate.nextCursor ?? null;
  const hasMore = typeof candidate.hasMore === "boolean" ? candidate.hasMore : nextCursor !== null;

  return {
    items: candidate.items,
    total: candidate.total ?? candidate.items.length,
    nextCursor,
    hasMore,
  };
}

export type InboxQueryScope = {
  filter?: InboxFilter;
  search?: string;
  feedId?: string;
  folderId?: string;
  includeRead?: boolean;
  sort?: InboxSort;
  itemId?: string;
  timezoneOffsetMinutes?: number;
};

function inboxItemsQueryKey({
  filter = DEFAULT_INBOX_FILTER,
  search,
  feedId,
  folderId,
  includeRead = false,
  sort = DEFAULT_INBOX_SORT,
  timezoneOffsetMinutes,
}: InboxQueryScope = {}) {
  return [
    ...queryKeys.inbox.items,
    INBOX_LIST_QUERY_VERSION,
    filter,
    search,
    feedId,
    folderId,
    includeRead,
    sort,
    timezoneOffsetMinutes,
  ] as const;
}

function sidebarInboxSummaryQueryKey(timezoneOffsetMinutes = getTimezoneOffsetMinutes()) {
  return [...queryKeys.sidebar.inboxSummary, "global", timezoneOffsetMinutes] as const;
}

export function inboxItemsInfiniteQueryOptions(scope: InboxQueryScope = {}) {
  const filter = scope.filter ?? DEFAULT_INBOX_FILTER;
  const includeRead = scope.includeRead ?? false;
  const sort = scope.sort ?? DEFAULT_INBOX_SORT;
  const timezoneOffsetMinutes = scope.timezoneOffsetMinutes;
  const isGlobalAllView = filter === "all" && !scope.feedId && !scope.folderId;

  return {
    queryKey: inboxItemsQueryKey({ ...scope, filter, includeRead, sort, timezoneOffsetMinutes }),
    enabled: timezoneOffsetMinutes !== undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      if (timezoneOffsetMinutes === undefined) {
        throw new Error("Inbox list query requires a client timezone offset.");
      }
      const page = await getInboxItems({
        data: {
          filter,
          search: scope.search,
          feedId: scope.feedId,
          folderId: scope.folderId,
          includeRead,
          cursor: pageParam,
          timezoneOffsetMinutes,
          sort,
        },
      });
      const normalized = normalizeInboxListPage(page);
      if (!normalized) {
        throw new Error("Inbox list response was missing required pagination fields.");
      }
      return normalized;
    },
    getNextPageParam: (lastPage: InboxListPage | undefined) => {
      const page = normalizeInboxListPage(lastPage);
      return page?.hasMore ? (page.nextCursor ?? undefined) : undefined;
    },
    staleTime: isGlobalAllView ? QUERY_TIMES.countsStale : QUERY_TIMES.listStale,
    gcTime: QUERY_TIMES.listGc,
    refetchOnMount: isGlobalAllView ? ("always" as const) : true,
    refetchOnWindowFocus: isGlobalAllView,
    refetchInterval: isGlobalAllView ? QUERY_TIMES.countsStale : (false as const),
  };
}

export function inboxDetailQueryOptions(itemId: string | undefined) {
  return {
    queryKey: queryKeys.inbox.itemDetail(itemId),
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
    refetchInterval: (query: { state: { data: unknown } }) => {
      const data = query.state.data as
        | { item?: { reader?: { extracted?: { status?: string; updatedAt?: string | null } } } }
        | undefined;
      const extracted = data?.item?.reader?.extracted;
      return extracted?.status === "pending" && extracted.updatedAt ? 2_500 : false;
    },
  };
}

export async function prefetchInboxItemDetail(
  queryClient: QueryClient,
  itemId: string | undefined,
) {
  if (!itemId) {
    return;
  }

  await queryClient.prefetchQuery(inboxDetailQueryOptions(itemId));
}

export function inboxRecapQueryOptions(limit = 5) {
  return {
    queryKey: queryKeys.inbox.recap,
    queryFn: () => getInboxRecap({ data: { limit } }),
    staleTime: QUERY_TIMES.countsStale,
    gcTime: QUERY_TIMES.listGc,
  };
}

function sidebarInboxSummaryQueryOptions(
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

export async function prefetchInboxSegmentedControlTarget(
  queryClient: QueryClient,
  scope: InboxQueryScope = {},
) {
  if (scope.feedId || scope.folderId) {
    return;
  }

  const timezoneOffsetMinutes = scope.timezoneOffsetMinutes ?? getTimezoneOffsetMinutes();
  const targetFilter: InboxFilter =
    (scope.filter ?? DEFAULT_INBOX_FILTER) === "my-feed" ? "all" : "my-feed";

  await queryClient.prefetchInfiniteQuery(
    inboxItemsInfiniteQueryOptions({
      ...scope,
      filter: targetFilter,
      feedId: undefined,
      folderId: undefined,
      itemId: undefined,
      timezoneOffsetMinutes,
    }),
  );
}

export async function prefetchInboxHotQueries(
  queryClient: QueryClient,
  scope: InboxQueryScope = {},
) {
  const timezoneOffsetMinutes = scope.timezoneOffsetMinutes ?? getTimezoneOffsetMinutes();

  void prefetchInboxSegmentedControlTarget(queryClient, {
    ...scope,
    timezoneOffsetMinutes,
  }).catch(() => undefined);

  await Promise.all([
    queryClient
      .prefetchInfiniteQuery(inboxItemsInfiniteQueryOptions({ ...scope, timezoneOffsetMinutes }))
      .catch(() => undefined),
    queryClient.prefetchQuery(sidebarInboxSummaryQueryOptions(timezoneOffsetMinutes)),
  ]);
}
