import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import {
  getInboxItemDetail,
  getInboxItems,
  getSidebarInboxCounts,
  type InboxFilter,
  type InboxItem,
  type InboxSort,
} from "../lib/articles/index";
import { getInboxRecap } from "../lib/recap/api";
import { getTimezoneOffsetMinutes, QUERY_TIMES } from "@lib/query/policies";

const DEFAULT_INBOX_FILTER: InboxFilter = "my-feed";
const DEFAULT_INBOX_SORT: InboxSort = "newest";
const INBOX_LIST_QUERY_VERSION = 4;
export const ACTIVE_FEED_REFRESH_POLL_INTERVAL_MS = 2_500;

export function hasActiveFeedRefresh(
  feeds: readonly { refreshStatus?: string | null }[] | null | undefined,
) {
  return (
    feeds?.some((feed) => feed.refreshStatus === "queued" || feed.refreshStatus === "running") ??
    false
  );
}

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
  sort?: InboxSort;
  itemId?: string;
  timezoneOffsetMinutes?: number;
};

type InboxFeedSwitchTarget = {
  feedId?: string | null;
};

type InboxFolderSwitchTarget = {
  id?: string | null;
};

type InboxSwitchTargetScope = InboxQueryScope & {
  feeds?: readonly InboxFeedSwitchTarget[];
  folders?: readonly InboxFolderSwitchTarget[];
};

const INBOX_SWITCH_FILTERS: readonly InboxFilter[] = ["my-feed", "all", "saved", "recent"];

export function followedFeedsQueryKey() {
  return ["feeds", "followed"] as const;
}

function followedFeedsUnreadCountsQueryKey() {
  return ["feeds", "followed", "unread-counts"] as const;
}

function inboxItemsQueryKey({
  filter = DEFAULT_INBOX_FILTER,
  search,
  feedId,
  folderId,
  includeRead,
  sort = DEFAULT_INBOX_SORT,
  timezoneOffsetMinutes,
}: InboxQueryScope = {}) {
  return [
    "inbox",
    "items",
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

function inboxDetailQueryKey(itemId: string | undefined) {
  return ["inbox", "item-detail", itemId] as const;
}

export function inboxRecapQueryKey() {
  return ["inbox", "recap"] as const;
}

function sidebarInboxSummaryQueryKey(timezoneOffsetMinutes = getTimezoneOffsetMinutes()) {
  return ["sidebar", "inbox-summary", "global", timezoneOffsetMinutes] as const;
}

function getScopeCacheKey(scope: InboxQueryScope) {
  return JSON.stringify([
    scope.filter ?? DEFAULT_INBOX_FILTER,
    scope.search,
    scope.feedId,
    scope.folderId,
    scope.includeRead,
    scope.sort ?? DEFAULT_INBOX_SORT,
    scope.timezoneOffsetMinutes,
  ]);
}

function addInboxSwitchScope(
  scopes: InboxQueryScope[],
  seenScopes: Set<string>,
  scope: InboxQueryScope,
) {
  const cacheKey = getScopeCacheKey(scope);
  if (seenScopes.has(cacheKey)) {
    return;
  }
  seenScopes.add(cacheKey);
  scopes.push(compactInboxSwitchScope(scope));
}

function compactInboxSwitchScope(scope: InboxQueryScope) {
  const compactedScope: InboxQueryScope = {};

  if (scope.filter !== undefined) {
    compactedScope.filter = scope.filter;
  }
  if (scope.search !== undefined) {
    compactedScope.search = scope.search;
  }
  if (scope.feedId !== undefined) {
    compactedScope.feedId = scope.feedId;
  }
  if (scope.folderId !== undefined) {
    compactedScope.folderId = scope.folderId;
  }
  if (scope.includeRead !== undefined) {
    compactedScope.includeRead = scope.includeRead;
  }
  if (scope.sort !== undefined) {
    compactedScope.sort = scope.sort;
  }
  if (scope.itemId !== undefined) {
    compactedScope.itemId = scope.itemId;
  }
  if (scope.timezoneOffsetMinutes !== undefined) {
    compactedScope.timezoneOffsetMinutes = scope.timezoneOffsetMinutes;
  }

  return compactedScope;
}

function buildInboxSwitchBaseScope(scope: InboxSwitchTargetScope): InboxQueryScope {
  const baseScope: InboxQueryScope = {
    sort: scope.sort ?? DEFAULT_INBOX_SORT,
    timezoneOffsetMinutes: scope.timezoneOffsetMinutes,
  };

  if (scope.search) {
    baseScope.search = scope.search;
  }
  if (scope.includeRead !== undefined) {
    baseScope.includeRead = scope.includeRead;
  }

  return baseScope;
}

export function getInboxSwitchTargetScopes(scope: InboxSwitchTargetScope = {}) {
  const scopes: InboxQueryScope[] = [];
  const seenScopes = new Set<string>();
  const baseScope = buildInboxSwitchBaseScope(scope);

  addInboxSwitchScope(scopes, seenScopes, {
    ...baseScope,
    filter: scope.filter ?? DEFAULT_INBOX_FILTER,
    feedId: scope.feedId,
    folderId: scope.folderId,
  });

  for (const filter of INBOX_SWITCH_FILTERS) {
    addInboxSwitchScope(scopes, seenScopes, {
      ...baseScope,
      filter,
      feedId: undefined,
      folderId: undefined,
    });
  }

  for (const feed of scope.feeds ?? []) {
    const feedId = feed.feedId?.trim();
    if (!feedId) {
      continue;
    }
    addInboxSwitchScope(scopes, seenScopes, {
      ...baseScope,
      filter: "all",
      search: undefined,
      feedId,
      folderId: undefined,
    });
  }

  for (const folder of scope.folders ?? []) {
    const folderId = folder.id?.trim();
    if (!folderId) {
      continue;
    }
    addInboxSwitchScope(scopes, seenScopes, {
      ...baseScope,
      filter: "all",
      feedId: undefined,
      folderId,
    });
  }

  return scopes;
}

export function inboxItemsInfiniteQueryOptions(scope: InboxQueryScope = {}) {
  const filter = scope.filter ?? DEFAULT_INBOX_FILTER;
  const sort = scope.sort ?? DEFAULT_INBOX_SORT;
  const timezoneOffsetMinutes = scope.timezoneOffsetMinutes;
  const isGlobalAllView = filter === "all" && !scope.feedId && !scope.folderId;

  return {
    queryKey: inboxItemsQueryKey({ ...scope, filter, sort, timezoneOffsetMinutes }),
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
    placeholderData: (previousData: InfiniteData<InboxListPage, string | undefined> | undefined) =>
      previousData,
    staleTime: isGlobalAllView ? QUERY_TIMES.countsStale : QUERY_TIMES.listStale,
    gcTime: QUERY_TIMES.listGc,
    refetchOnMount: isGlobalAllView ? ("always" as const) : true,
    refetchOnWindowFocus: isGlobalAllView,
    refetchInterval: isGlobalAllView ? QUERY_TIMES.countsStale : (false as const),
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
    queryKey: inboxRecapQueryKey(),
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

export function invalidateFeedAndInboxQueries(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["feeds"] });
  void queryClient.invalidateQueries({ queryKey: followedFeedsQueryKey() });
  void queryClient.invalidateQueries({ queryKey: followedFeedsUnreadCountsQueryKey() });
  void queryClient.invalidateQueries({ queryKey: ["inbox", "items"] });
  void queryClient.invalidateQueries({ queryKey: inboxRecapQueryKey() });
  void queryClient.invalidateQueries({ queryKey: ["inbox", "view-count"] });
  void queryClient.invalidateQueries({ queryKey: ["sidebar", "inbox-summary"] });
}

export async function prefetchInboxHotQueries(
  queryClient: QueryClient,
  scope: InboxQueryScope = {},
) {
  const timezoneOffsetMinutes = scope.timezoneOffsetMinutes ?? getTimezoneOffsetMinutes();

  await Promise.all([
    prefetchInboxSwitchTargets(queryClient, { ...scope, timezoneOffsetMinutes }),
    queryClient.prefetchQuery(sidebarInboxSummaryQueryOptions(timezoneOffsetMinutes)),
  ]);
}

export async function prefetchInboxSwitchTargets(
  queryClient: QueryClient,
  scope: InboxSwitchTargetScope = {},
) {
  const timezoneOffsetMinutes = scope.timezoneOffsetMinutes ?? getTimezoneOffsetMinutes();
  const switchScopes = getInboxSwitchTargetScopes({ ...scope, timezoneOffsetMinutes });

  await Promise.all(
    switchScopes.map((switchScope) =>
      queryClient
        .prefetchInfiniteQuery(
          inboxItemsInfiniteQueryOptions({ ...switchScope, timezoneOffsetMinutes }),
        )
        .catch(() => undefined),
    ),
  );
}
