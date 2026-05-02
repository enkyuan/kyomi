import type { ArticleReaderContentDto, ExtractedContentStatus } from "./content.types";
import type { ArticleReaderDto } from "../types";

export type ReaderMode = "original" | "extracted";

export function inferDefaultReaderMode(args: {
  readerOriginal: ArticleReaderContentDto;
  readerExtracted: ArticleReaderContentDto | null;
  extractedContentStatus: ExtractedContentStatus;
}): ReaderMode {
  const { readerExtracted, extractedContentStatus } = args;
  const extractedReady = extractedContentStatus === "ready" && readerExtracted !== null;

  if (extractedReady) {
    return "extracted";
  }
  return "original";
}

export function buildArticleReaderDto(args: {
  readerOriginal: ArticleReaderContentDto;
  readerExtracted: ArticleReaderContentDto | null;
  extractedContentStatus: ExtractedContentStatus;
  extractedContentError: string | null;
  extractedContentUpdatedAt: string | null;
}): ArticleReaderDto {
  const activeMode = inferDefaultReaderMode(args);
  const selected =
    activeMode === "extracted" && args.readerExtracted ? args.readerExtracted : args.readerOriginal;
  return {
    activeMode,
    selected,
    original: {
      available: true,
      content: args.readerOriginal,
    },
    extracted: {
      available: args.readerExtracted !== null,
      content: args.readerExtracted,
      status: args.extractedContentStatus,
      error: args.extractedContentError,
      updatedAt: args.extractedContentUpdatedAt,
    },
  };
}
