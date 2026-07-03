"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { extractInboxItemFullText } from "@modules/inbox/lib/articles/index";

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
