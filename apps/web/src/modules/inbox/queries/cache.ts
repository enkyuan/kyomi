"use client";

import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";
import type { ArticleDetailDto } from "@lib/schemas";
import type { InboxItem } from "../services/api";
import type { InboxListPage } from "./options";

type InboxItemPatch = Partial<Pick<InboxItem, "isRead" | "isSaved">>;

type InboxItemsInfiniteData = InfiniteData<InboxListPage>;
type InboxDetailData = { item: ArticleDetailDto | null };

export type InboxItemCacheSnapshot = {
  detail?: InboxDetailData;
  items: Array<readonly [QueryKey, InboxItemsInfiniteData | undefined]>;
};

export function getInboxItemCacheSnapshot(
  queryClient: QueryClient,
  itemId: string,
): InboxItemCacheSnapshot {
  return {
    detail: queryClient.getQueryData<InboxDetailData>(["inbox", "item-detail", itemId]),
    items: queryClient.getQueriesData<InboxItemsInfiniteData>({ queryKey: ["inbox", "items"] }),
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
  queryClient.setQueryData(["inbox", "item-detail", itemId], snapshot.detail);
}

export function updateInboxItemCaches(
  queryClient: QueryClient,
  itemId: string,
  patch: InboxItemPatch,
  removeFromList: boolean,
) {
  queryClient.setQueriesData<InboxItemsInfiniteData>({ queryKey: ["inbox", "items"] }, (data) => {
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
  });

  queryClient.setQueryData<{ item: ArticleDetailDto | null }>(
    ["inbox", "item-detail", itemId],
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
