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
  /** Retained on the wire for existing native development builds. Display uses sourceLabel. */
  readonly feedTitle: string;
  readonly faviconUrls: readonly string[];
  readonly isSaved?: boolean;
  /** The article was started and left unfinished; the row shows the continue badge. */
  readonly isContinuing?: boolean;
  /** Badge text with the time left. Omit to show the style's `continueLabel`. */
  readonly continueLabel?: string;
};

export type ArticleListRowAction = "toggleSaved" | "share" | "openSource" | "hide" | "report";

/**
 * A change to the rows the list shows. Rows are not a prop: Fabric converts every prop again on
 * each update to any prop, so the list is fed through `ArticleListHandle.applyOps` instead.
 */
export type ArticleListOp =
  /** Replaces every row. `epoch` must grow with each reset. */
  | {
      readonly type: "reset";
      readonly epoch: number;
      readonly rows: readonly ArticleListRow[];
      readonly scrollToTop?: boolean;
    }
  /** Adds rows after the last one; a row whose id is already listed is updated in place. */
  | { readonly type: "append"; readonly rows: readonly ArticleListRow[] }
  /** Replaces the content of listed rows; ids that are not listed are ignored. */
  | { readonly type: "update"; readonly rows: readonly ArticleListRow[] }
  | { readonly type: "remove"; readonly ids: readonly string[] }
  /**
   * Where paging stands, sent in the same batch as the rows it describes so the list never sees
   * one without the other. `pageCount` must grow with every page that arrives, even one whose rows
   * were all filtered out: it is what lets the list ask for the next page again.
   */
  | {
      readonly type: "paging";
      readonly pageCount: number;
      readonly hasMore: boolean;
      readonly isLoadingMore: boolean;
    };

/** What a ref to `ArticleListView` exposes. */
export type ArticleListHandle = {
  /** `payload` is `JSON.stringify` of an `ArticleListOp[]`, applied in order. */
  readonly applyOps: (payload: string) => Promise<void>;
  /** Scroll to an article by stable ID. Returns false when it is not loaded. */
  readonly scrollToItem: (id: string, animated: boolean) => Promise<boolean>;
  /** Native content offset, including negative top-inset positions. */
  readonly scrollToOffset: (offset: number, animated: boolean) => Promise<void>;
};

export type ArticleListInsets = {
  readonly top: number;
  readonly bottom: number;
};

export type ArticleListViewProps = ViewProps & {
  readonly listStyle: ArticleListStyle;
  readonly refreshing?: boolean;
  readonly onRefresh?: () => void;
  /** Emitted only when visible IDs change, in display order. */
  readonly onVisibleItemsChange?: (event: NativeSyntheticEvent<{ ids: string[] }>) => void;
  /** Space the content keeps clear of the floating header and tab bar. */
  readonly contentInset?: ArticleListInsets;
  readonly scrollIndicatorInset?: ArticleListInsets;
  /** Let UIKit inset the list under a native navigation header instead of `contentInset`. */
  readonly adjustsInsetsAutomatically?: boolean;
  /** How many rows from the last one `onEndReached` fires. Default 5. */
  readonly endReachedDistance?: number;
  /** Scrolls to the top whenever the value changes. */
  readonly scrollToTopToken?: number;
  /**
   * The next page is wanted: a row within `endReachedDistance` of the last is on screen, more
   * pages exist and none is loading (see the `paging` operation). Fires once per page; a failed
   * fetch is asked for again when the user next drags.
   */
  readonly onEndReached?: () => void;
  /** `maxY` is the resting offset at the end of the list; larger offsets are overscroll. */
  readonly onScroll?: (event: NativeSyntheticEvent<{ y: number; maxY: number }>) => void;
  readonly onRowPress?: (event: NativeSyntheticEvent<{ id: string }>) => void;
  readonly onRowPressIn?: (event: NativeSyntheticEvent<{ id: string }>) => void;
  readonly onRowAction?: (
    event: NativeSyntheticEvent<{ id: string; action: ArticleListRowAction }>,
  ) => void;
};
