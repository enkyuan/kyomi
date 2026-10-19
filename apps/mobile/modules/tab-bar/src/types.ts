import type { ColorValue, NativeSyntheticEvent, ViewProps } from "react-native";

export type TabBarIconPath = {
  readonly d: string;
  readonly fillRule?: "evenodd" | "nonzero";
};

/** SVG geometry drawn natively, in the shape of `@kyomi/ui` native icons. */
export type TabBarIcon = {
  readonly viewBox: string;
  readonly paths: readonly TabBarIconPath[];
};

export type TabBarItem = {
  readonly key: string;
  readonly label: string;
  readonly icon: TabBarIcon;
  readonly selectedIcon: TabBarIcon;
};

/** The narrower slot after the tabs. It redirects to another view instead of selecting a tab. */
export type TabBarSwitcher = {
  readonly label: string;
  readonly hint: string;
  readonly icon: TabBarIcon;
};

export type TabBarViewProps = ViewProps & {
  readonly tabs: readonly TabBarItem[];
  readonly selectedIndex: number;
  readonly switcher?: TabBarSwitcher;
  readonly minimized?: boolean;
  readonly activeTintColor?: ColorValue;
  readonly searchPlaceholder?: string;
  /** Fires on every press, including one on the selected tab. */
  readonly onTabPress?: (event: NativeSyntheticEvent<{ index: number }>) => void;
  readonly onSwitcherPress?: () => void;
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
