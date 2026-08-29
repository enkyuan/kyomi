import { Platform, type TextStyle } from "react-native";

// Use the fonts' PostScript names so SwiftUI's Font.custom resolves each face.
export const FONT_FAMILIES = {
  inter: {
    regular: "Inter-Regular",
    medium: "Inter-Medium",
    semibold: "Inter-SemiBold",
    bold: "Inter-Bold",
  },
  dmSans: {
    regular: "DMSans-Regular",
    medium: "DMSans-Medium",
    semibold: "DMSans-SemiBold",
  },
} as const;

export const FONT_WEIGHTS = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const SWIFT_FONT_WEIGHTS = {
  regular: "regular",
  medium: "medium",
  semibold: "semibold",
  bold: "bold",
} as const;

function platformValue<T>(ios: T, android: T): T {
  return Platform.select({ android, default: ios, ios }) ?? ios;
}

/**
 * App typography follows Apple's 17pt body baseline and Material 3's 16sp
 * body baseline. Native text still scales with the user's accessibility size.
 */
export const FONT_SIZES = {
  largeTitle: platformValue(34, 32),
  navigationTitle: platformValue(28, 24),
  toolbarTitle: 20,
  compactTitle: 17,
  hero: platformValue(30, 28),
  screenTitle: 24,
  sectionTitle: platformValue(22, 24),
  bodyLarge: platformValue(17, 16),
  body: 16,
  bodyMedium: platformValue(15, 14),
  bodySmall: platformValue(13, 12),
  button: platformValue(17, 14),
  input: platformValue(17, 16),
  otp: 22,
  meta: 14,
  readerSource: 14,
  readerBody: platformValue(17, 16),
  readerTitleMin: platformValue(30, 24),
  readerTitleMax: platformValue(40, 32),
  badgeDefault: 15,
  badgeLarge: 17,
  badgeSmall: 13,
  badgeExtraSmall: 10,
} as const;

export const FONT_STYLES = {
  largeTitle: {
    fontFamily: FONT_FAMILIES.inter.bold,
    fontSize: FONT_SIZES.largeTitle,
    fontWeight: FONT_WEIGHTS.bold,
    lineHeight: platformValue(41, 40),
  },
  navigationTitle: {
    fontFamily: FONT_FAMILIES.inter.bold,
    fontSize: FONT_SIZES.navigationTitle,
    fontWeight: FONT_WEIGHTS.bold,
    lineHeight: platformValue(34, 32),
  },
  toolbarTitle: {
    fontFamily: FONT_FAMILIES.inter.semibold,
    fontSize: FONT_SIZES.toolbarTitle,
    fontWeight: FONT_WEIGHTS.semibold,
    lineHeight: 24,
  },
  compactTitle: {
    fontFamily: FONT_FAMILIES.inter.semibold,
    fontSize: FONT_SIZES.compactTitle,
    fontWeight: FONT_WEIGHTS.semibold,
    lineHeight: platformValue(22, 20),
  },
  hero: {
    fontFamily: FONT_FAMILIES.inter.semibold,
    fontSize: FONT_SIZES.hero,
    fontWeight: FONT_WEIGHTS.semibold,
    lineHeight: platformValue(36, 34),
  },
  screenTitle: {
    fontFamily: FONT_FAMILIES.inter.semibold,
    fontSize: FONT_SIZES.screenTitle,
    fontWeight: FONT_WEIGHTS.semibold,
    lineHeight: platformValue(29, 32),
  },
  sectionTitle: {
    fontFamily: FONT_FAMILIES.inter.semibold,
    fontSize: FONT_SIZES.sectionTitle,
    fontWeight: FONT_WEIGHTS.semibold,
    lineHeight: platformValue(28, 32),
  },
  bodyLarge: {
    fontFamily: FONT_FAMILIES.inter.regular,
    fontSize: FONT_SIZES.bodyLarge,
    fontWeight: FONT_WEIGHTS.regular,
    lineHeight: platformValue(24, 24),
  },
  body: {
    fontFamily: FONT_FAMILIES.inter.regular,
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.regular,
    lineHeight: platformValue(22, 24),
  },
  bodyMedium: {
    fontFamily: FONT_FAMILIES.inter.regular,
    fontSize: FONT_SIZES.bodyMedium,
    fontWeight: FONT_WEIGHTS.regular,
    lineHeight: platformValue(21, 20),
  },
  bodyMediumMedium: {
    fontFamily: FONT_FAMILIES.inter.medium,
    fontSize: FONT_SIZES.bodyMedium,
    fontWeight: FONT_WEIGHTS.medium,
    lineHeight: platformValue(21, 20),
  },
  bodySmall: {
    fontFamily: FONT_FAMILIES.inter.regular,
    fontSize: FONT_SIZES.bodySmall,
    fontWeight: FONT_WEIGHTS.regular,
    lineHeight: platformValue(18, 16),
  },
  button: {
    fontFamily: FONT_FAMILIES.inter.semibold,
    fontSize: FONT_SIZES.button,
    fontWeight: FONT_WEIGHTS.semibold,
    lineHeight: platformValue(22, 20),
  },
  input: {
    fontFamily: FONT_FAMILIES.inter.regular,
    fontSize: FONT_SIZES.input,
    fontWeight: FONT_WEIGHTS.regular,
    lineHeight: platformValue(24, 24),
  },
  otp: {
    fontFamily: FONT_FAMILIES.inter.semibold,
    fontSize: FONT_SIZES.otp,
    fontWeight: FONT_WEIGHTS.semibold,
    lineHeight: platformValue(27, 28),
  },
  meta: {
    fontFamily: FONT_FAMILIES.inter.medium,
    fontSize: FONT_SIZES.meta,
    fontWeight: FONT_WEIGHTS.medium,
    lineHeight: platformValue(18, 20),
  },
  readerSource: {
    fontFamily: FONT_FAMILIES.dmSans.regular,
    fontSize: FONT_SIZES.readerSource,
    fontWeight: FONT_WEIGHTS.regular,
    lineHeight: platformValue(18, 20),
  },
  readerBody: {
    fontFamily: FONT_FAMILIES.dmSans.regular,
    fontSize: FONT_SIZES.readerBody,
    fontWeight: FONT_WEIGHTS.regular,
    lineHeight: platformValue(29, 27),
  },
  error: {
    fontFamily: FONT_FAMILIES.inter.regular,
    fontSize: FONT_SIZES.bodySmall,
    fontWeight: FONT_WEIGHTS.regular,
    lineHeight: platformValue(18, 16),
  },
  badgeDefault: {
    fontFamily: FONT_FAMILIES.inter.medium,
    fontSize: FONT_SIZES.badgeDefault,
    fontWeight: FONT_WEIGHTS.medium,
    lineHeight: 18,
  },
  badgeLarge: {
    fontFamily: FONT_FAMILIES.inter.medium,
    fontSize: FONT_SIZES.badgeLarge,
    fontWeight: FONT_WEIGHTS.medium,
    lineHeight: 20,
  },
  badgeSmall: {
    fontFamily: FONT_FAMILIES.inter.medium,
    fontSize: FONT_SIZES.badgeSmall,
    fontWeight: FONT_WEIGHTS.medium,
    lineHeight: 16,
  },
  badgeExtraSmall: {
    fontFamily: FONT_FAMILIES.inter.medium,
    fontSize: FONT_SIZES.badgeExtraSmall,
    fontWeight: FONT_WEIGHTS.medium,
    lineHeight: 12,
  },
} satisfies Record<string, TextStyle>;

export type MobileFontStyle = (typeof FONT_STYLES)[keyof typeof FONT_STYLES];
