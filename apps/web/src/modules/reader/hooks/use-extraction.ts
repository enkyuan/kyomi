"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toastManager } from "@kyomi/ui/toast";
import { getUserSafeErrorMessage, logClientError } from "@kyomi/reader/lib/errors";
import type { ArticleDetailDto, ExtractFullTextResponseDto } from "@kyomi/reader/schemas";
import { extractInboxItemFullText } from "@modules/articles/lib/api";
import { queryKeys } from "@lib/query/keys";

function useArticleExtraction(itemId: string | undefined) {
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
      const queryKey = queryKeys.inbox.itemDetail(itemId);
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
      queryClient.setQueryData(queryKeys.inbox.itemDetail(itemId), context.previous);
    },
    onSuccess: (data) => {
      if (!itemId) {
        return;
      }
      queryClient.setQueryData(queryKeys.inbox.itemDetail(itemId), {
        item: data.article,
      });
    },
  });
}

export function useReaderExtract({
  autoExtract,
  canRequestExtraction,
  isViewingExtracted,
  item,
}: {
  autoExtract: boolean;
  canRequestExtraction: boolean;
  isViewingExtracted: boolean;
  item: ArticleDetailDto;
}) {
  const extractMutation = useArticleExtraction(item.id);
  const requestedExtractionForItemRef = useRef<string | null>(null);
  const shouldAutoExtract =
    autoExtract &&
    canRequestExtraction &&
    item.reader.extracted.status === "pending" &&
    item.reader.extracted.content === null;
  const showFailedBanner =
    isViewingExtracted &&
    item.reader.extracted.status === "failed" &&
    item.reader.extracted.content === null &&
    Boolean(item.reader.extracted.error);

  const runExtract = useCallback(
    (reason: "auto" | "manual") => {
      if (extractMutation.isPending) {
        return;
      }

      const extractionPromise = extractMutation
        .mutateAsync()
        .then((result: ExtractFullTextResponseDto) => {
          if (!result.ok) {
            const detail = [result.errorMessage, result.errorCode].filter(Boolean).join(" ");
            throw new Error(detail || "Extraction failed");
          }
          return result;
        });

      if (reason === "auto") {
        void extractionPromise.catch(() => {
          requestedExtractionForItemRef.current = null;
        });
        return;
      }

      void toastManager.promise(extractionPromise, {
        loading: {
          title: "Extracting full text...",
          description: "Fetching full article text.",
          type: "loading",
          timeout: 0,
        },
        success: (result) =>
          result.status === "ready"
            ? {
                title: "Full text ready",
                description: "Article content has been refreshed.",
                type: "success",
              }
            : {
                title: "Extraction queued",
                description: "The article will update when full text is ready.",
                type: "info",
              },
        error: (error) => {
          logClientError("reader.extract", error);
          return {
            title: "Extraction failed",
            description: getUserSafeErrorMessage(
              error,
              "Could not fetch extracted article content.",
            ),
            type: "error",
          };
        },
      });
    },
    [extractMutation],
  );

  useEffect(() => {
    if (!shouldAutoExtract || extractMutation.isPending) {
      return;
    }
    if (requestedExtractionForItemRef.current === item.id) {
      return;
    }

    requestedExtractionForItemRef.current = item.id;
    runExtract("auto");
  }, [extractMutation.isPending, item.id, runExtract, shouldAutoExtract]);

  return {
    extractPending: extractMutation.isPending,
    extractionError: item.reader.extracted.error,
    onRetryExtraction: () => runExtract("manual"),
    showFailedBanner,
  };
}
