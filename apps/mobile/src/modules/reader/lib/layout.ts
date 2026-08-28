import { FONT_SIZES } from "@/theme/fonts";

export const mobileReaderLayout = {
  contentInsetPx: 20,
  headerBottomMarginPx: 32,
  source: {
    fontSizePx: FONT_SIZES.readerSource,
    marginBottomPx: 12,
  },
  title: {
    lineHeight: 1.08,
    maxFontSizePx: FONT_SIZES.readerTitleMax,
    minFontSizePx: FONT_SIZES.readerTitleMin,
    skeletonLines: 3,
  },
  body: {
    fontSizePx: FONT_SIZES.readerBody,
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
  titleLineSpacingPx: 4,
} as const;
