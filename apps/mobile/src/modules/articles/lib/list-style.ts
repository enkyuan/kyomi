import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import {
  ArrowShareRightNativeIcon,
  BLODE_STROKE_WIDTH,
  BookmarkFilledNativeIcon,
  BookmarkNativeIcon,
  EllipsisNativeIcon,
  RssNativeIcon,
  type BlodeNativeIcon,
} from "@kyomi/ui/icons/blode-native";
import { kyomiNativeBrand } from "@kyomi/ui/native/theme";
import type { ArticleListIcon, ArticleListStyle } from "../../../../modules/article-list";
import { mobileColors } from "@/theme/colors";
import { FONT_STYLES } from "@/theme/fonts";
import { useTheme } from "@ui/liquid-glass/hooks/use-theme";
import { ACTION_ICON_SIZE, feedItemTypography } from "./layout";

function toListIcon(icon: BlodeNativeIcon): ArticleListIcon {
  return {
    viewBox: icon.viewBox,
    paths: icon.paths.map((path) => ({
      d: path.d,
      fillRule: path.fillRule,
      strokeWidth: path.stroke ? BLODE_STROKE_WIDTH : undefined,
    })),
  };
}

const ICONS = {
  bookmarkFilledIcon: toListIcon(BookmarkFilledNativeIcon),
  bookmarkIcon: toListIcon(BookmarkNativeIcon),
  moreIcon: toListIcon(EllipsisNativeIcon),
  rssIcon: toListIcon(RssNativeIcon),
  shareIcon: toListIcon(ArrowShareRightNativeIcon),
} as const;

/** `bg-matcha/8` in light mode, `/16` in dark, as the React Native `Badge` draws it. */
const BADGE_BACKGROUND = {
  dark: "rgba(168, 212, 128, 0.16)",
  light: "rgba(168, 212, 128, 0.08)",
} as const;

/** `bg-border/70`: the shared border token is black 8% in light and white 8% in dark. */
const ROW_DIVIDER = {
  dark: "rgba(255, 255, 255, 0.056)",
  light: "rgba(0, 0, 0, 0.056)",
} as const;

/** Resolves the shared theme into the tokens the native article rows draw with. */
export function useArticleListStyle(): ArticleListStyle {
  const { colors, scheme } = useTheme();
  const { width } = useWindowDimensions();
  const compactBadge = width <= 360;

  return useMemo(() => {
    const { metaFontSizePx, summaryFontSizePx, summaryLineHeightPx, summaryMaxLines } =
      feedItemTypography;
    const badge = compactBadge ? FONT_STYLES.badgeSmall : FONT_STYLES.badgeLarge;

    return {
      ...ICONS,
      actionIconSize: ACTION_ICON_SIZE,
      badgeBackground: BADGE_BACKGROUND[scheme],
      badgeFont: {
        family: badge.fontFamily,
        lineHeight: badge.lineHeight,
        size: badge.fontSize,
      },
      badgeHeight: compactBadge ? 22 : 30,
      badgeText:
        scheme === "dark" ? kyomiNativeBrand.matcha.color : kyomiNativeBrand.matcha.onColor,
      border: ROW_DIVIDER[scheme],
      card: colors.card,
      continueLabel: "Continue reading",
      emptySummary: "No summary available.",
      foreground: colors.foreground,
      metaFont: {
        family: FONT_STYLES.meta.fontFamily,
        lineHeight: FONT_STYLES.meta.lineHeight,
        size: metaFontSizePx,
      },
      mutedForeground: colors.mutedForeground,
      mutedIcon: mobileColors.mutedIcon,
      saved: kyomiNativeBrand.mizu.color,
      secondary: colors.secondary,
      summaryFont: {
        family: FONT_STYLES.body.fontFamily,
        lineHeight: summaryLineHeightPx,
        size: summaryFontSizePx,
      },
      summaryMaxLines,
      titleFont: {
        family: FONT_STYLES.screenTitle.fontFamily,
        lineHeight: feedItemTypography.titleLineHeightPx,
        size: feedItemTypography.titleFontSizePx,
      },
    };
  }, [colors, compactBadge, scheme]);
}
