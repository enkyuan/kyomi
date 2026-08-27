import type { NativeSyntheticEvent, ViewProps } from "react-native";

export type KyomiTab = "feeds" | "all";
export type KyomiSourceKind = "folder" | "feed";

export type KyomiSourceItem = {
  readonly id: string;
  readonly title: string;
  readonly kind: KyomiSourceKind;
  readonly iconUrl?: string;
  readonly unreadCount?: number;
};

export type KyomiTabSelectEvent = NativeSyntheticEvent<{ tab: KyomiTab }>;
export type KyomiSourceSelectEvent = NativeSyntheticEvent<{
  id: string;
  kind: KyomiSourceKind;
}>;
export type KyomiSearchQueryEvent = NativeSyntheticEvent<{ query: string }>;

export type KyomiNativeTabBarProps = ViewProps & {
  readonly activeTab: KyomiTab;
  readonly sources: readonly KyomiSourceItem[];
  readonly selectedSourceId?: string;
  readonly minimized: boolean;
  readonly searchActive: boolean;
  readonly onSelectTab?: (event: KyomiTabSelectEvent) => void;
  readonly onSelectSource?: (event: KyomiSourceSelectEvent) => void;
  readonly onSearchPress?: () => void;
  readonly onSearchQueryChange?: (event: KyomiSearchQueryEvent) => void;
  readonly onSearchSubmit?: (event: KyomiSearchQueryEvent) => void;
  readonly onSearchClose?: () => void;
};
