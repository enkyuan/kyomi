"use client";

import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { ArticleDetailDto } from "@lib/api-schemas";
import type { InboxItem } from "../services/api";
import type { InboxListPage } from "./options";

type InboxItemPatch = Partial<Pick<InboxItem, "isRead" | "isSaved">>;

type InboxItemsInfiniteData = InfiniteData<InboxListPage>;

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
