import { router } from "expo-router";
import type { NativeSyntheticEvent } from "react-native";
import { InboxIconGeometry } from "@kyomi/ui/icons/inbox";
import { Album2FillNativeIcon, Album2LineNativeIcon } from "@kyomi/ui/icons/mingcute-native";
import { SwitcherIconGeometry } from "@kyomi/ui/icons/switcher";
import { useKeyboard } from "@hooks/use-keyboard";
import { mobileColors } from "@/theme/colors";
import {
  TabBarView,
  tabBarMetrics,
  type TabBarItem,
  type TabBarSwitcher,
} from "../../../../modules/tab-bar";
import type { TabBarProps } from "./lib/types";

const TABS: readonly TabBarItem[] = [
  {
    key: "inbox",
    label: "Feeds",
    icon: { viewBox: InboxIconGeometry.viewBox, paths: [InboxIconGeometry.line] },
    selectedIcon: { viewBox: InboxIconGeometry.viewBox, paths: [InboxIconGeometry.fill] },
  },
  {
    key: "explore",
    label: "Explore articles",
    icon: Album2LineNativeIcon,
    selectedIcon: Album2FillNativeIcon,
  },
];

const SWITCHER: TabBarSwitcher = {
  label: "Choose source",
  hint: "Opens folders and feeds",
  icon: { viewBox: SwitcherIconGeometry.viewBox, paths: [{ d: SwitcherIconGeometry.d }] },
};

/** Floating tab bar drawn natively in SwiftUI by the local `tab-bar` module. */
export function TabBar({
  minimized = false,
  navigation,
  onSearchQueryChange,
  onSearchSubmit,
  onTabChange,
  state,
}: TabBarProps) {
  const { height: keyboardHeight } = useKeyboard();
  const selectedIndex = Math.min(Math.max(state?.index ?? 0, 0), TABS.length - 1);
  // The bar rests on the screen edge and keeps `keyboardGap` above the keyboard.
  const bottom =
    keyboardHeight > 0 ? keyboardHeight + tabBarMetrics.keyboardGap - tabBarMetrics.edgeInset : 0;

  function handleTabPress({ nativeEvent: { index } }: NativeSyntheticEvent<{ index: number }>) {
    onTabChange?.(index);

    const route = state?.routes[index];
    if (!state || !navigation || !route) return;
    const event = navigation.emit({ canPreventDefault: true, target: route.key, type: "tabPress" });
    if (state.index !== index && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  }

  return (
    <TabBarView
      activeTintColor={mobileColors.matcha}
      minimized={minimized}
      onSearchQueryChange={({ nativeEvent }) => onSearchQueryChange?.(nativeEvent.query)}
      onSearchSubmit={({ nativeEvent }) => onSearchSubmit?.(nativeEvent.query)}
      onSwitcherPress={() => router.push("/(protected)/switcher")}
      onTabPress={handleTabPress}
      searchPlaceholder="Search feeds or articles"
      selectedIndex={selectedIndex}
      style={{
        bottom,
        height: tabBarMetrics.containerHeight,
        left: 0,
        position: "absolute",
        right: 0,
      }}
      switcher={SWITCHER}
      tabs={TABS}
    />
  );
}

export default TabBar;
export type { TabBarProps };
