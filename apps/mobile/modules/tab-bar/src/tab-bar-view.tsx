import { NativeModule, requireNativeModule, requireNativeView } from "expo";
import type { TabBarMetrics, TabBarViewProps } from "./types";

declare class TabBarModule extends NativeModule<{}> implements TabBarMetrics {
  readonly containerHeight: number;
  readonly edgeInset: number;
  readonly keyboardGap: number;
}

const NativeTabBarView = requireNativeView<TabBarViewProps>("TabBar");

export const tabBarMetrics: TabBarMetrics = requireNativeModule<TabBarModule>("TabBar");

export function TabBarView(props: TabBarViewProps) {
  return <NativeTabBarView {...props} />;
}
