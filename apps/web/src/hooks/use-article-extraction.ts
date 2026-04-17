"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { extractInboxItemFullText } from "@lib/inbox-functions";

type DetailCacheShape = {
  item: {
    id: string;
    extractedContentHtml: string | null;
    extractedContentText: string | null;
    extractedContentStatus: "pending" | "ready" | "failed";
    extractedContentError: string | null;
  } | null;
};

export function useArticleExtraction(itemId: string, onSuccessExtracted?: () => void) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => extractInboxItemFullText({ data: { itemId } }),
    onSuccess: (result) => {
      queryClient.setQueryData(["inbox", "item-detail", itemId], (previous: DetailCacheShape) => {
        if (!previous?.item) {
          return previous;
        }
        return {
          ...previous,
          item: {
            ...previous.item,
            extractedContentHtml: result.reader.contentHtml,
            extractedContentText: result.reader.contentText,
            extractedContentStatus: result.reader.contentStatus === "ready" ? "ready" : "failed",
            extractedContentError: result.reader.extractionErrorMessage,
          },
        };
      });
      queryClient.invalidateQueries({ queryKey: ["inbox", "item-detail", itemId] });
      onSuccessExtracted?.();
    },
  });

  return {
    extractFullText: mutation.mutate,
    isExtracting: mutation.isPending,
    extractionError: mutation.error,
  };
}
