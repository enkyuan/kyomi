"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { getInboxItems, InboxFilter, InboxSort } from "@modules/articles/lib/api";
import { inboxDetailQueryOptions, inboxItemsInfiniteQueryOptions } from "../queries/options";

type UseInboxQueriesInput = {
  filter: InboxFilter;
  search?: string;
  feedId?: string;
  folderId?: string;
  itemId?: string;
  includeRead?: boolean;
  sort?: InboxSort;
  timezoneOffsetMinutes?: number;
};

/**
 * De-duplicates by id across infinite-query pages.
 * The API also collapses same-feed canonical URL duplicates server-side - this is only a client
 * idempotency guard.
 */
export function dedupePagedInboxItemsById(
  pages: Array<{ items: Awaited<ReturnType<typeof getInboxItems>>["items"] }> | undefined,
) {
  if (!pages) return [];
  const unique = new Map<string, Awaited<ReturnType<typeof getInboxItems>>["items"][number]>();
  for (const page of pages) {
    if (!page?.items) {
      continue;
    }
    for (const item of page.items) {
      if (!unique.has(item.id)) {
        unique.set(item.id, item);
      }
    }
  }
  return Array.from(unique.values());
}

export function useInboxQueries({
  filter,
  search,
  feedId,
  folderId,
  itemId,
  includeRead,
  sort,
  timezoneOffsetMinutes,
}: UseInboxQueriesInput) {
  const {
    data: inboxData,
    dataUpdatedAt: inboxDataUpdatedAt,
    fetchNextPage: fetchNextInboxPage,
    hasNextPage: hasNextInboxPage,
    isFetching: isInboxFetching,
    isFetchingNextPage: isInboxFetchingNextPage,
    isPending: isInboxPending,
  } = useInfiniteQuery(
    inboxItemsInfiniteQueryOptions({
      filter,
      search,
      feedId,
      folderId,
      includeRead,
      sort,
      timezoneOffsetMinutes,
    }),
  );

  const {
    data: detailData,
    error: detailError,
    isError: isDetailError,
    isFetching: isDetailFetching,
  } = useQuery(inboxDetailQueryOptions(itemId));

  return {
    detailData,
    detailError,
    fetchNextInboxPage,
    hasNextInboxPage,
    inboxData,
    inboxDataUpdatedAt,
    isDetailError,
    isDetailFetching,
    isInboxFetching,
    isInboxFetchingNextPage,
    isInboxPending,
  };
}
