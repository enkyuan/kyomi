"use client";

import { useCallback, useEffect, useRef } from "react";
import { toastManager } from "@kyomi/ui/atoms/toast";
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
          type: "loading",
          timeout: 0,
        },
        success: (result) =>
          result.status === "ready"
            ? {
                title: "Full text ready",
                type: "success",
              }
            : {
                title: "Extraction queued",
                type: "info",
              },
        error: (error) => {
          logClientError("reader.extract", error);
          return {
            title: getUserSafeErrorMessage(error, "Could not extract article content"),
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
