"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getInboxItems, type InboxFilter } from "@modules/inbox/api";
import {
  inboxDetailQueryOptions,
  inboxItemsInfiniteQueryOptions,
} from "@modules/inbox/lib/query-options";

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
 * De-duplicates by id when flattening infinite-query pages (React Query can briefly overlap pages).
 * The API also collapses same-feed canonical URL duplicates server-side — this is only a client
 * idempotency guard.
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

/** @deprecated Prefer `dedupePagedInboxItemsById` (same implementation). */
export const dedupeInboxItems = dedupePagedInboxItemsById;

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
