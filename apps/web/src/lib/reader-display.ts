import type { ArticleDetailDto, ReaderContentDto } from "@lib/api-schemas";
import type { ReaderMode } from "@lib/reader-mode";

/**
 * Picks the active reader payload from the article detail response.
 * `defaultReaderMode` is the server hint; UI may override via local `ReaderMode` state.
 */
export function readerContentForMode(item: ArticleDetailDto, mode: ReaderMode): ReaderContentDto {
  if (mode === "extracted" && item.readerExtracted) {
    return item.readerExtracted;
  }
  return item.readerOriginal;
}
