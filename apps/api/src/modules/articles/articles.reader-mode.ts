import type { ArticleReaderContentDto, ExtractedContentStatus } from "./articles.content.types";

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
