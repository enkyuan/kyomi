"use client";

import { useCallback, useEffect, useRef } from "react";
import { toastManager } from "@kyomi/ui/toast";
import { getUserSafeErrorMessage, logClientError } from "@lib/errors";
import type { ArticleDetailDto, ExtractFullTextResponseDto } from "@lib/schemas/index";
import { useArticleExtraction } from "@modules/reader/hooks/use-extraction";

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
        success: {
          title: "Full text ready",
          description: "Article content has been refreshed.",
          type: "success",
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
