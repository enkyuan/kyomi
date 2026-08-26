"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { extractInboxItemFullText } from "@modules/inbox/lib/articles/index";
import type { ArticleDetailDto } from "@kyomi/reader/schemas";

export function useArticleExtraction(itemId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["inbox", "extract-full-text", itemId],
    mutationFn: async () => {
      if (!itemId) {
        throw new Error("Missing article id");
      }
      return extractInboxItemFullText({ data: { itemId } });
    },
    onMutate: () => {
      if (!itemId) {
        return;
      }
      const queryKey = ["inbox", "item-detail", itemId] as const;
      const previous = queryClient.getQueryData<{ item: ArticleDetailDto }>(queryKey);
      queryClient.setQueryData<{ item: ArticleDetailDto }>(queryKey, (current) => {
        if (!current?.item) {
          return current;
        }
        return {
          item: {
            ...current.item,
            reader: {
              ...current.item.reader,
              extracted: {
                ...current.item.reader.extracted,
                status: "pending",
                error: null,
                updatedAt: new Date().toISOString(),
              },
            },
          },
        };
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (!itemId || !context?.previous) {
        return;
      }
      queryClient.setQueryData(["inbox", "item-detail", itemId], context.previous);
    },
    onSuccess: (data) => {
      if (!itemId) {
        return;
      }
      queryClient.setQueryData(["inbox", "item-detail", itemId], {
        item: data.article,
      });
    },
  });
}
