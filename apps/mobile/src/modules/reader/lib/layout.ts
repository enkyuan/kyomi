export const mobileReaderLayout = {
  contentInsetPx: 20,
  headerBottomMarginPx: 32,
  source: {
    fontSizePx: 14,
    marginBottomPx: 12,
  },
  title: {
    lineHeight: 1.08,
    maxFontSizePx: 40,
    minFontSizePx: 30,
    skeletonLines: 3,
  },
  summary: {
    fontSizePx: 17,
    lineHeight: 1.55,
    marginTopPx: 16,
    skeletonLines: 4,
  },
  body: {
    fontSizePx: 17,
    lineHeight: 1.68,
    paragraphGapEm: 1.15,
  },
} as const;

export const mobileReaderSkeletonLayout = {
  bodyLineHeightPx: mobileReaderLayout.body.fontSizePx,
  bodyLineSpacingPx: 12,
  paragraphGapPx: 20,
  titleLineHeightPx: Math.round(
    mobileReaderLayout.title.minFontSizePx * mobileReaderLayout.title.lineHeight,
  ),
} as const;
