import type { ColorValue, NativeSyntheticEvent, ViewProps } from "react-native";

export type ArticleListIconPath = {
  readonly d: string;
  readonly fillRule?: "evenodd" | "nonzero";
  /** Stroke width in viewBox units for a line glyph; omit to fill. */
  readonly strokeWidth?: number;
};

/** Blode geometry, in the shape of `@kyomi/ui` native icons. */
export type ArticleListIcon = {
  readonly viewBox: string;
  readonly paths: readonly ArticleListIconPath[];
};

export type ArticleListFont = {
  readonly family: string;
  readonly size: number;
  readonly lineHeight: number;
};

/** The shared mobile theme, resolved by JavaScript so native rows never hard-code a token. */
export type ArticleListStyle = {
  readonly foreground: ColorValue;
  readonly mutedForeground: ColorValue;
  readonly border: ColorValue;
  readonly secondary: ColorValue;
  readonly card: ColorValue;
  readonly mutedIcon: ColorValue;
  readonly saved: ColorValue;
  readonly badgeBackground: ColorValue;
  readonly badgeText: ColorValue;
  readonly metaFont: ArticleListFont;
  readonly titleFont: ArticleListFont;
  readonly summaryFont: ArticleListFont;
  readonly badgeFont: ArticleListFont;
  readonly badgeHeight: number;
  readonly summaryMaxLines: number;
  readonly actionIconSize: number;
  readonly bookmarkIcon: ArticleListIcon;
  readonly bookmarkFilledIcon: ArticleListIcon;
  readonly shareIcon: ArticleListIcon;
  readonly moreIcon: ArticleListIcon;
  readonly rssIcon: ArticleListIcon;
  readonly continueLabel: string;
  readonly emptySummary: string;
};

export type ArticleListRow = {
  readonly id: string;
  /** `article` rows carry an action toolbar; `recent` rows are a plain history entry. */
  readonly kind: "article" | "recent";
  readonly sourceLabel: string;
  /** Relative publish time for articles; the "Viewed …" label for recents. */
  readonly timeLabel: string;
  readonly title: string;
  readonly summary?: string;
  readonly faviconUrls: readonly string[];
  readonly feedTitle: string;
  readonly isSaved?: boolean;
  readonly isContinuing?: boolean;
};

export type ArticleListRowAction = "toggleSaved" | "share" | "openSource" | "hide" | "report";

export type ArticleListInsets = {
  readonly top: number;
  readonly bottom: number;
};

export type ArticleListViewProps = ViewProps & {
  readonly rows: readonly ArticleListRow[];
  readonly listStyle: ArticleListStyle;
  /** Space the content keeps clear of the floating header and tab bar. */
  readonly contentInset?: ArticleListInsets;
  readonly scrollIndicatorInset?: ArticleListInsets;
  /** Let UIKit inset the list under a native navigation header instead of `contentInset`. */
  readonly adjustsInsetsAutomatically?: boolean;
  /**
   * More pages exist; `onEndReached` fires once per page while this is true. Fetch state stays in
   * JS: every prop change re-sends all props, `rows` included, so it is not mirrored here.
   */
  readonly hasMore?: boolean;
  /** Distance from the end, in viewport heights, that triggers the next page. */
  readonly endReachedThreshold?: number;
  /** Scrolls to the top whenever the value changes. */
  readonly scrollToTopToken?: number;
  readonly onEndReached?: () => void;
  readonly onScroll?: (event: NativeSyntheticEvent<{ y: number }>) => void;
  readonly onRowPress?: (event: NativeSyntheticEvent<{ id: string }>) => void;
  readonly onRowPressIn?: (event: NativeSyntheticEvent<{ id: string }>) => void;
  readonly onRowAction?: (
    event: NativeSyntheticEvent<{ id: string; action: ArticleListRowAction }>,
  ) => void;
};
