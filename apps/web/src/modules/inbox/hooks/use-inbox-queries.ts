"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getInboxItems, type InboxFilter } from "../services/api";
import { inboxDetailQueryOptions, inboxItemsInfiniteQueryOptions } from "../queries/options";

type UseInboxQueriesInput = {
  filter: InboxFilter;
  search?: string;
  feedId?: string;
  folderId?: string;
  itemId?: string;
  includeRead?: boolean;
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
  timezoneOffsetMinutes,
}: UseInboxQueriesInput) {
  const inboxQuery = useInfiniteQuery(
    inboxItemsInfiniteQueryOptions({
      filter,
      search,
      feedId,
      folderId,
      includeRead,
      timezoneOffsetMinutes,
    }),
  );

  const detailQuery = useQuery(inboxDetailQueryOptions(itemId));

  return { inboxQuery, detailQuery };
}
