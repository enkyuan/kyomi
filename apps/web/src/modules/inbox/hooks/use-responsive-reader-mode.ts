"use client";

import { useMediaQuery } from "@hooks/use-media-query";

export type InboxLayoutVariant = "split" | "reader-focused" | "stacked";

const INBOX_SPLIT_MIN_WIDTH_PX = 1024;
const INBOX_READER_FOCUS_MIN_WIDTH_PX = 800;

/**
 * Inbox main-column layout by available content width:
 * - wide: split (list + detail)
 * - tablet-width landscape: reader-focused (detail fills main; auto-select first item)
 * - narrow: stacked (single column list <-> detail, same as mobile)
 */
export function useResponsiveReaderMode(contentWidthPx?: number): InboxLayoutVariant {
  const isWideViewport = useMediaQuery({ min: "lg", defaultMatches: true });
  const isLandscape = useMediaQuery({ orientation: "landscape" });
  const isTabletRange = useMediaQuery({ min: "md", max: "lg" });

  if (contentWidthPx && contentWidthPx > 0) {
    if (contentWidthPx >= INBOX_SPLIT_MIN_WIDTH_PX) {
      return "split";
    }
    if (contentWidthPx >= INBOX_READER_FOCUS_MIN_WIDTH_PX && isLandscape) {
      return "reader-focused";
    }
    return "stacked";
  }

  // Desktop defaults to split regardless of orientation.
  if (isWideViewport) {
    return "split";
  }
  if (isTabletRange && isLandscape) {
    return "reader-focused";
  }
  return "stacked";
}
