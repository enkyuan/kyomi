import type { InboxDensityDto } from "@lib/schemas/index";

export const INBOX_PANEL_SPACING_PX = 4;

const FEED_ITEM_ROW_ESTIMATE = {
  comfortable: 252,
  compact: 204,
  comfortableReaderFocus: 272,
  compactReaderFocus: 220,
} as const;

export const MIN_SKELETON_ROWS = 3;
export const MAX_SKELETON_ROWS = 12;
export const DEFAULT_SKELETON_ROWS = 6;
export const SKELETON_OVERSCAN_ROWS = 1;

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
