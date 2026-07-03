import type { ArticleDetailDto, ReaderContentDto } from "@lib/schemas/index";
import type { ReaderMode } from "./mode";

/**
 * Reader selection contract:
 * - server owns content/body-kind/fallback normalization,
 * - client may only switch between explicit modes (original/extracted).
 */
export function readerContentForMode(item: ArticleDetailDto, mode: ReaderMode): ReaderContentDto {
  if (mode === "extracted") {
    return item.reader.extracted.content ?? item.reader.selected;
  }
  return item.reader.original.content;
}
