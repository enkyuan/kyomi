import type { InboxDensityDto } from "@lib/api-schemas";

export function getTypography({
  density,
  fontSizePx,
  readerFocusMode,
}: {
  density: InboxDensityDto;
  fontSizePx: number;
  readerFocusMode: boolean;
}) {
  const isCompact = density === "compact";
  const titleFontSizePx = isCompact ? Math.max(14, fontSizePx - 1) : fontSizePx;
  const titleLineHeightPx = isCompact ? titleFontSizePx + 5 : titleFontSizePx + 6;
  const titleFont = `600 ${titleFontSizePx}px "Inter Variable"`;
  const summaryFontSizePx = Math.max(12, Math.round(fontSizePx * 0.875));
  const summaryLineHeightPx = Math.round(
    summaryFontSizePx * (readerFocusMode ? (isCompact ? 1.42 : 1.48) : isCompact ? 1.38 : 1.45),
  );
  const summaryMaxLines = readerFocusMode ? (isCompact ? 4 : 5) : isCompact ? 2 : 3;
  const summaryFont = `400 ${summaryFontSizePx}px "Inter Variable"`;
  const metaFontSizePx = Math.max(11, Math.round(fontSizePx * 0.75));
  const sourceLabelFontSizePx = isCompact ? Math.max(11, metaFontSizePx - 1) : metaFontSizePx;

  return {
    isCompact,
    titleFontSizePx,
    titleLineHeightPx,
    titleFont,
    summaryFontSizePx,
    summaryLineHeightPx,
    summaryMaxLines,
    summaryFont,
    metaFontSizePx,
    sourceLabelFontSizePx,
  };
}

export function getSectionClassNames({
  readerFocusMode,
  isCompact,
}: {
  readerFocusMode: boolean;
  isCompact: boolean;
}) {
  return {
    header: readerFocusMode
      ? isCompact
        ? "gap-2 py-3"
        : "gap-2.5 py-3.5"
      : isCompact
        ? "gap-1.5 py-2.5"
        : "gap-2 py-3",
    footer: readerFocusMode
      ? isCompact
        ? "mt-2 pb-3"
        : "mt-2.5 pb-3.5"
      : isCompact
        ? "mt-1.5 pb-2.5"
        : "mt-2 pb-3",
  };
}
