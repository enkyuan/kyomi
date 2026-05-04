"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getInboxItems, type InboxFilter } from "./api";
import { inboxDetailQueryOptions, inboxItemsInfiniteQueryOptions } from "./lib/query-options";

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
 * De-duplicates by primary key when combining infinite-query pages. React Query can briefly
 * overlap windows; canonical article duplicate collapse belongs server-side.
 */
export function dedupePagedInboxItemsById(
  items: Awaited<ReturnType<typeof getInboxItems>>["items"],
) {
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
