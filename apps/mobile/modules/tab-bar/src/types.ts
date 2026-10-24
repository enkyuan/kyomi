import type { ColorValue, NativeSyntheticEvent, ViewProps } from "react-native";

export type TabBarIconPath = {
  readonly d: string;
  readonly fillRule?: "evenodd" | "nonzero";
  /** Stroke width in viewBox units for a line glyph (round caps and joins); omit to fill. */
  readonly strokeWidth?: number;
};

/** SVG geometry drawn natively, in the shape of `@kyomi/ui` native icons. */
export type TabBarIcon = {
  readonly viewBox: string;
  /** Clockwise rotation about the icon's centre, in degrees. */
  readonly rotation?: number;
  readonly paths: readonly TabBarIconPath[];
};

export type TabBarItem = {
  readonly key: string;
  readonly label: string;
  readonly icon: TabBarIcon;
  readonly selectedIcon: TabBarIcon;
};

/** The narrower slot after the tabs. It opens a sheet, zoomed out of the bar, instead of selecting a tab. */
export type TabBarSwitcher = {
  /** Title of the sheet the switcher opens. */
  readonly title: string;
  readonly label: string;
  readonly hint: string;
  readonly icon: TabBarIcon;
};

/** A feed the add composer offers to follow, or the one it previews to import. */
export type TabBarComposerFeed = {
  readonly id: string;
  /** Set for a feed Kyomi already knows; the composer follows it by id instead of by address. */
  readonly feedId?: string;
  readonly url: string;
  readonly title: string;
  readonly detail?: string;
  readonly faviconUrl?: string;
  readonly isSubscribed: boolean;
};

export type TabBarComposerFolder = { readonly id: string; readonly name: string };

export type TabBarViewProps = ViewProps & {
  readonly tabs: readonly TabBarItem[];
  readonly selectedIndex: number;
  readonly switcher?: TabBarSwitcher;
  /** Magnifying glass for the search button and field; omit to use the SF Symbol. */
  readonly searchIcon?: TabBarIcon;
  /** Magnifying glass for the add composer's field; omit to use the SF Symbol. */
  readonly composerIcon?: TabBarIcon;
  /** Plus on each composer result not yet followed; omit to use the SF Symbol. */
  readonly composerAddIcon?: TabBarIcon;
  /** Check on each composer result already followed or filed in a folder; omit to use the SF Symbol. */
  readonly composerAddedIcon?: TabBarIcon;
  /** Plus for the add button at the trailing edge; omit to use the SF Symbol. */
  readonly addIcon?: TabBarIcon;
  /** Colour of the plus drawn on the tinted (`activeTintColor`) add button. */
  readonly addIconColor?: ColorValue;
  readonly minimized?: boolean;
  readonly activeTintColor?: ColorValue;
  readonly searchPlaceholder?: string;
  /** Fires on every press, including one on the selected tab. */
  readonly onTabPress?: (event: NativeSyntheticEvent<{ index: number }>) => void;
  /** What the primary button of the add composer does: import a typed address, or follow a search result. */
  readonly composerKind?: "import" | "follow";
  readonly composerFeeds?: readonly TabBarComposerFeed[];
  readonly composerFolders?: readonly TabBarComposerFolder[];
  /** `done` closes the composer; `failed` shows `composerMessage`. */
  readonly composerStatus?: "idle" | "loading" | "submitting" | "done" | "failed";
  readonly composerMessage?: string;
  readonly onComposerActiveChange?: (event: NativeSyntheticEvent<{ active: boolean }>) => void;
  readonly onComposerQueryChange?: (event: NativeSyntheticEvent<{ query: string }>) => void;
  readonly onComposerSubmit?: (
    event: NativeSyntheticEvent<{ feedId: string; url: string; folderId: string }>,
  ) => void;
  readonly onSearchActiveChange?: (event: NativeSyntheticEvent<{ active: boolean }>) => void;
  readonly onSearchQueryChange?: (event: NativeSyntheticEvent<{ query: string }>) => void;
  readonly onSearchSubmit?: (event: NativeSyntheticEvent<{ query: string }>) => void;
};

/** Geometry owned by the native bar, for the space React Native reserves around it. */
export type TabBarMetrics = {
  /** Height of the bar's container: the capsule and its gap above the screen edge. */
  readonly containerHeight: number;
  /** Gap between the capsule and the screen's side and bottom edges. */
  readonly edgeInset: number;
  /** Gap kept between the capsule and the keyboard. */
  readonly keyboardGap: number;
};
