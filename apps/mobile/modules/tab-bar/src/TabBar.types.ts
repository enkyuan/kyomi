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
  /** Glyphs of the sheet's chips: edit the folders (select and delete), sort them, and add one. */
  readonly editIcon: TabBarIcon;
  readonly sortIcon: TabBarIcon;
  readonly addIcon: TabBarIcon;
};

/** A folder the switcher sheet lists, with the number of feeds filed in it. */
export type TabBarSwitcherFolder = {
  readonly id: string;
  readonly name: string;
  readonly feedCount: number;
  /** ISO instant the folder was made, for sorting by age. */
  readonly createdAt: string;
};

/** A feed filed in a folder, listed when the sheet opens that folder. */
export type TabBarSwitcherFeed = {
  readonly id: string;
  readonly folderId: string;
  readonly title: string;
  readonly faviconUrl?: string;
};

/** What was done to a folder in the switcher sheet. `create` has no `folderId`; `delete` no `name`; `reorder` has neither, and its `name` is the folder ids in their new order, one per line. */
export type TabBarSwitcherFolderAction = {
  readonly action: "create" | "rename" | "delete" | "reorder";
  readonly folderId: string;
  readonly name: string;
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

/** One tool of the reader bar, drawn natively from Blode geometry. */
export type TabBarReaderTool = {
  readonly key: string;
  readonly label: string;
  readonly icon: TabBarIcon;
  /** The glyph while `selected`, usually the filled variant; omit to keep `icon`. */
  readonly selectedIcon?: TabBarIcon;
  readonly selected?: boolean;
  /** The colour of the glyph while `selected`; omit for the bar's accent. */
  readonly selectedTint?: ColorValue;
  readonly disabled?: boolean;
};

/**
 * The reader's tools. While it is set the capsule is the reader bar, and the bar morphs between the
 * two. The tool with key `textSize` opens a slider above the bar natively and reports its steps
 * through `onReaderFontSizeChange`; every other tool reports a press through `onReaderToolPress`.
 */
export type TabBarReader = {
  readonly tools: readonly TabBarReaderTool[];
  readonly fontSize: number;
  readonly minFontSize: number;
  readonly maxFontSize: number;
  /** Accessibility label of the slider. */
  readonly fontSizeLabel: string;
  /**
   * The article's link. The native bar opens the system share sheet for it out of the share tool;
   * without it the share tool is a plain press.
   */
  readonly shareUrl?: string;
};

export type TabBarViewProps = ViewProps & {
  readonly tabs: readonly TabBarItem[];
  readonly selectedIndex: number;
  readonly switcher?: TabBarSwitcher;
  readonly switcherFolders?: readonly TabBarSwitcherFolder[];
  readonly switcherFeeds?: readonly TabBarSwitcherFeed[];
  readonly onSwitcherFolderAction?: (
    event: NativeSyntheticEvent<TabBarSwitcherFolderAction>,
  ) => void;
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
  /** `null` when no reader is open, so the native bar is told the reader has gone, not left to infer it. */
  readonly reader?: TabBarReader | null;
  readonly onReaderToolPress?: (event: NativeSyntheticEvent<{ key: string }>) => void;
  /** Each step of the size slider (`committed` false) and its release (`committed` true). */
  readonly onReaderFontSizeChange?: (
    event: NativeSyntheticEvent<{ size: number; committed: boolean }>,
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
