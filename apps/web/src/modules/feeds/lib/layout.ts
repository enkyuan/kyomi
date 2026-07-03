import type { InboxDensityDto } from "@lib/schemas/index";

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
  const readableFontSizePx = fontSizePx + 2;
  const titleFontSizePx = isCompact
    ? Math.max(16, readableFontSizePx - 1)
    : Math.max(17, readableFontSizePx);
  const titleLineHeightPx = isCompact ? titleFontSizePx + 6 : titleFontSizePx + 7;
  const titleFont = `600 ${titleFontSizePx}px "Inter Variable"`;
  const summaryFontSizePx = Math.max(14, Math.round(readableFontSizePx * 0.92));
  const summaryLineHeightPx = Math.round(
    summaryFontSizePx * (readerFocusMode ? (isCompact ? 1.48 : 1.54) : isCompact ? 1.44 : 1.5),
  );
  const summaryMaxLines = readerFocusMode ? (isCompact ? 4 : 5) : isCompact ? 2 : 3;
  const summaryFont = `400 ${summaryFontSizePx}px "Inter Variable"`;
  const metaFontSizePx = Math.max(13, Math.round(readableFontSizePx * 0.78));
  const sourceLabelFontSizePx = Math.max(13, metaFontSizePx);

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
        ? "gap-3.5 pt-4 pb-2"
        : "gap-4 pt-5 pb-2.5"
      : isCompact
        ? "gap-3.5 pt-4 pb-2"
        : "gap-4 pt-5 pb-2.5",
    footer: readerFocusMode
      ? isCompact
        ? "mt-2.5 pb-3"
        : "mt-3 pb-4"
      : isCompact
        ? "mt-2.5 pb-3"
        : "mt-3 pb-4",
  };
}
