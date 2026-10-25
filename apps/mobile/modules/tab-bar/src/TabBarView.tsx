import { requireNativeView } from "expo";
import type { TabBarViewProps } from "./TabBar.types";

const NativeTabBarView = requireNativeView<TabBarViewProps>("TabBar");

export function TabBarView(props: TabBarViewProps) {
  return <NativeTabBarView {...props} />;
}
