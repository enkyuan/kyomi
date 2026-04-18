import type { ReaderContentDto } from "@lib/api-schemas";

export type ReaderMode = "original" | "extracted";

/** Mirrors server `inferDefaultReaderMode` — keep rules aligned. */
export function inferDefaultReaderMode(args: {
  readerOriginal: ReaderContentDto;
  readerExtracted: ReaderContentDto | null;
  extractedContentStatus: "pending" | "ready" | "failed";
}): ReaderMode {
  const { readerExtracted, extractedContentStatus } = args;
  const extractedReady = extractedContentStatus === "ready" && readerExtracted !== null;

  if (extractedReady) {
    return "extracted";
  }
  return "original";
}
