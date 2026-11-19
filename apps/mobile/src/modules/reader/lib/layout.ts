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
    /**
     * The text size preference scales the glyphs only: the space between blocks and a list's indent
     * are fixed at the default size, so the column keeps its rhythm and padding as the size changes.
     */
    blockGapPx: Math.round(FONT_SIZES.readerBody * 1.15),
    listIndentPx: Math.round(FONT_SIZES.readerBody * 1.3),
    headingGapPx: {
      bottom: Math.round(FONT_SIZES.readerBody * 0.75),
      top: Math.round(FONT_SIZES.readerBody * 2.4),
    },
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
