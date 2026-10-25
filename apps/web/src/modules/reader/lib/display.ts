import type {
  ArticleDetailDto,
  ReaderContentDto,
  ReaderDefaultModeDto,
} from "@kyomi/reader/schemas";
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

/** The mode the reader renders: `smart` follows the server's choice for this article. */
export function resolveReaderMode(
  item: ArticleDetailDto,
  defaultMode: ReaderDefaultModeDto,
): ReaderMode {
  return defaultMode === "smart" ? item.reader.activeMode : defaultMode;
}
