import { NativeModule, requireNativeModule } from "expo";
import type { TabBarMetrics } from "./TabBar.types";

declare class TabBarModule extends NativeModule<{}> implements TabBarMetrics {
  readonly containerHeight: number;
  readonly edgeInset: number;
  readonly keyboardGap: number;
}

export const tabBarMetrics: TabBarMetrics = requireNativeModule<TabBarModule>("TabBar");
