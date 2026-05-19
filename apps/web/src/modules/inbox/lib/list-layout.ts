import type { InboxDensityDto } from "src/lib/schemas";

export const FEED_ITEM_ROW_ESTIMATE = {
  comfortable: 232,
  compact: 180,
  comfortableReaderFocus: 248,
  compactReaderFocus: 196,
} as const;

export const MIN_SKELETON_ROWS = 3;
export const MAX_SKELETON_ROWS = 12;
export const DEFAULT_SKELETON_ROWS = 6;
export const SKELETON_OVERSCAN_ROWS = 1;
export const STATIC_LIST_ITEM_LIMIT = 250;

export function getFeedItemRowEstimate({
  density,
  readerFocusMode,
}: {
  density: InboxDensityDto;
  readerFocusMode: boolean;
}) {
  return FEED_ITEM_ROW_ESTIMATE[
    readerFocusMode
      ? density === "compact"
        ? "compactReaderFocus"
        : "comfortableReaderFocus"
      : density
  ];
}
