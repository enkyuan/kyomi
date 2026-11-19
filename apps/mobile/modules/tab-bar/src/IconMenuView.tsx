import { requireNativeView } from "expo";
import type { ViewProps } from "react-native";
import type { TabBarIcon } from "./TabBar.types";

export type IconMenuItem = {
  id: string;
  title: string;
  checked: boolean;
  icon: TabBarIcon;
};

export type IconMenuViewProps = ViewProps & {
  items: IconMenuItem[];
  /** SF Symbol name for the glyph on the glass button that opens the menu. */
  symbol: string;
  tintColor?: string;
  onSelect: (event: { nativeEvent: { id: string } }) => void;
};

const NativeIconMenuView = requireNativeView<IconMenuViewProps>("TabBar", "IconMenuView");

/** A native glass button that opens a menu; its items carry Blode glyphs. */
export function IconMenuView(props: IconMenuViewProps) {
  return <NativeIconMenuView {...props} />;
}
