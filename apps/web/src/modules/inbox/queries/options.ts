import type { QueryClient } from "@tanstack/react-query";
import {
  getInboxItemDetail,
  getInboxItems,
  getSidebarInboxCounts,
  type InboxFilter,
  type InboxItem,
} from "../services/api";
import { getTimezoneOffsetMinutes, QUERY_TIMES } from "@lib/query-policies";

export type InboxListPage = {
  items: InboxItem[];
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
};

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
  itemId?: string;
  timezoneOffsetMinutes?: number;
};

export function followedFeedsQueryKey() {
  return ["feeds", "followed"] as const;
}

function followedFeedsUnreadCountsQueryKey() {
  return ["feeds", "followed", "unread-counts"] as const;
}

export function feedRefreshStatusQueryKey(folderId?: string | null) {
  return ["feeds", "refresh-status", folderId ?? "__all__"] as const;
}

export function inboxViewCountQueryKey(scope: {
  filter: string;
  feedId?: string | null;
  folderId?: string | null;
  timezoneOffsetMinutes?: number;
  includeRead?: boolean;
}) {
  return [
    "inbox",
    "view-count",
    scope.filter,
    scope.feedId,
    scope.folderId,
    scope.timezoneOffsetMinutes,
    scope.includeRead,
  ] as const;
}

function inboxItemsQueryKey({
  filter = "inbox",
  search,
  feedId,
  folderId,
  includeRead,
  timezoneOffsetMinutes,
}: InboxQueryScope = {}) {
  return [
    "inbox",
    "items",
    filter,
    search,
    feedId,
    folderId,
    includeRead,
    timezoneOffsetMinutes,
  ] as const;
}

function inboxDetailQueryKey(itemId: string | undefined) {
  return ["inbox", "item-detail", itemId] as const;
}

function sidebarInboxSummaryQueryKey(timezoneOffsetMinutes = getTimezoneOffsetMinutes()) {
  return ["sidebar", "inbox-summary", "global", timezoneOffsetMinutes] as const;
}

export function inboxItemsInfiniteQueryOptions(scope: InboxQueryScope = {}) {
  const filter = scope.filter ?? "inbox";
  const timezoneOffsetMinutes = scope.timezoneOffsetMinutes;

  return {
    queryKey: inboxItemsQueryKey({ ...scope, filter, timezoneOffsetMinutes }),
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
          includeRead: scope.includeRead,
          cursor: pageParam,
          timezoneOffsetMinutes,
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

export function invalidateFeedAndInboxQueries(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["feeds"] });
  void queryClient.invalidateQueries({ queryKey: followedFeedsQueryKey() });
  void queryClient.invalidateQueries({ queryKey: followedFeedsUnreadCountsQueryKey() });
  void queryClient.invalidateQueries({ queryKey: ["feed-detail"] });
  void queryClient.invalidateQueries({ queryKey: ["feeds", "refresh-status"] });
  void queryClient.invalidateQueries({ queryKey: ["inbox", "items"] });
  void queryClient.invalidateQueries({ queryKey: ["inbox", "view-count"] });
  void queryClient.invalidateQueries({ queryKey: ["sidebar", "inbox-summary"] });
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
