import type { InboxDensityDto } from "@lib/schemas";

export const MIN_INBOX_LEFT_PERCENT = 28;
export const MIN_INBOX_RIGHT_PERCENT = 60;
export const INBOX_PANEL_SPACING_PX = 4;

export const INBOX_PANEL_VERTICAL_PADDING_STYLE = {
  paddingBlock: `${INBOX_PANEL_SPACING_PX}px`,
} as const;

/** Uniform gutter around reader-focus panels (matches vertical split spacing). */
export const INBOX_PANEL_OUTER_PADDING_STYLE = {
  padding: `${INBOX_PANEL_SPACING_PX}px`,
} as const;

export const INBOX_DETAIL_PANEL_OUTER_SPACING_STYLE = {
  paddingInlineEnd: `${INBOX_PANEL_SPACING_PX}px`,
} as const;

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
