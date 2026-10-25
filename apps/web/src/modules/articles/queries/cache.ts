"use client";

import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";
import type { ArticleDetailDto } from "@kyomi/reader/schemas";
import type { ReadingPositionDto, ReadingProgressDto } from "@kyomi/reader/schemas/article";
import type { InboxItem, InboxListPage } from "../lib/api";
import { queryKeys } from "@lib/query/keys";

type InboxItemPatch = Partial<Pick<InboxItem, "isRead" | "isSaved">>;

type InboxItemsInfiniteData = InfiniteData<InboxListPage>;
type InboxDetailData = { item: ArticleDetailDto | null };

type InboxItemCacheSnapshot = {
  detail?: InboxDetailData;
  items: Array<readonly [QueryKey, InboxItemsInfiniteData | undefined]>;
};

export function getInboxItemCacheSnapshot(
  queryClient: QueryClient,
  itemId: string,
): InboxItemCacheSnapshot {
  return {
    detail: queryClient.getQueryData<InboxDetailData>(queryKeys.inbox.itemDetail(itemId)),
    items: queryClient.getQueriesData<InboxItemsInfiniteData>({ queryKey: queryKeys.inbox.items }),
  };
}

export function restoreInboxItemCacheSnapshot(
  queryClient: QueryClient,
  itemId: string,
  snapshot?: InboxItemCacheSnapshot,
) {
  if (!snapshot) {
    return;
  }

  for (const [queryKey, data] of snapshot.items) {
    queryClient.setQueryData(queryKey, data);
  }
  queryClient.setQueryData(queryKeys.inbox.itemDetail(itemId), snapshot.detail);
}

export function updateInboxItemCaches(
  queryClient: QueryClient,
  itemId: string,
  patch: InboxItemPatch,
  removeFromList: boolean,
) {
  queryClient.setQueriesData<InboxItemsInfiniteData>(
    { queryKey: queryKeys.inbox.items },
    (data) => {
      if (!data) {
        return data;
      }

      return {
        ...data,
        pages: data.pages.flatMap((page) => {
          if (!page?.items) {
            return [];
          }
          const items = removeFromList
            ? page.items.filter((item) => item.id !== itemId)
            : page.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item));

          return [
            {
              ...page,
              items,
              total: items.length,
              hasMore: Boolean(page.hasMore),
              nextCursor: page.nextCursor ?? null,
            },
          ];
        }),
      };
    },
  );

  queryClient.setQueryData<{ item: ArticleDetailDto | null }>(
    queryKeys.inbox.itemDetail(itemId),
    (data) => {
      if (!data?.item) {
        return data;
      }

      return {
        ...data,
        item: {
          ...data.item,
          ...patch,
        },
      };
    },
  );
}

/**
 * Applies the server's reading state after a progress write: list rows get the new
 * `readingProgress` (badge), and the cached detail gets it plus the position written, so reopening
 * the article from cache restores where the reader stopped instead of the position it first loaded.
 */
export function updateReadingProgressCaches(
  queryClient: QueryClient,
  itemId: string,
  state: { readingProgress: ReadingProgressDto; readingPosition: ReadingPositionDto },
) {
  queryClient.setQueriesData<InboxItemsInfiniteData>(
    { queryKey: queryKeys.inbox.items },
    (data) => {
      if (!data) {
        return data;
      }

      return {
        ...data,
        pages: data.pages.map((page) =>
          page?.items?.some((item) => item.id === itemId)
            ? {
                ...page,
                items: page.items.map((item) =>
                  item.id === itemId ? { ...item, readingProgress: state.readingProgress } : item,
                ),
              }
            : page,
        ),
      };
    },
  );

  queryClient.setQueryData<InboxDetailData>(queryKeys.inbox.itemDetail(itemId), (data) =>
    data?.item
      ? {
          ...data,
          item: {
            ...data.item,
            readingProgress: state.readingProgress,
            readingPosition: state.readingPosition,
          },
        }
      : data,
  );
}
