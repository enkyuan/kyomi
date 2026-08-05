const FONT_SIZE_PX = 16;

function getTypography() {
  const readableFontSizePx = FONT_SIZE_PX + 2;
  const titleFontSizePx = Math.max(17, readableFontSizePx);
  const titleLineHeightPx = titleFontSizePx + 7;
  const summaryFontSizePx = Math.max(14, Math.round(readableFontSizePx * 0.92));
  const summaryLineHeightPx = Math.round(summaryFontSizePx * 1.5);
  const summaryMaxLines = 3;
  const metaFontSizePx = Math.max(13, Math.round(readableFontSizePx * 0.78));

  return {
    titleFontSizePx,
    titleLineHeightPx,
    summaryFontSizePx,
    summaryLineHeightPx,
    summaryMaxLines,
    metaFontSizePx,
  };
}

export const feedItemTypography = getTypography();
