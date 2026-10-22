import { router } from "expo-router";
import type { NativeSyntheticEvent } from "react-native";
import {
  AlbumsFilledNativeIcon,
  AlbumsNativeIcon,
  BLODE_STROKE_WIDTH,
  ChevronsUpDownNativeIcon,
  InboxFilledNativeIcon,
  InboxNativeIcon,
  type BlodeNativeIcon,
} from "@kyomi/ui/icons/blode-native";
import { useKeyboard } from "@hooks/use-keyboard";
import { mobileColors } from "@/theme/colors";
import {
  TabBarView,
  tabBarMetrics,
  type TabBarIcon,
  type TabBarItem,
  type TabBarSwitcher,
} from "../../../../modules/tab-bar";
import type { TabBarProps } from "./lib/types";

/** Maps Blode geometry to the native bar: line glyphs carry their stroke width, filled ones none. */
function toTabBarIcon(icon: BlodeNativeIcon): TabBarIcon {
  return {
    viewBox: icon.viewBox,
    paths: icon.paths.map((path) => ({
      d: path.d,
      fillRule: path.fillRule,
      strokeWidth: path.stroke ? BLODE_STROKE_WIDTH : undefined,
    })),
  };
}

const TABS: readonly TabBarItem[] = [
  {
    key: "inbox",
    label: "Feeds",
    icon: toTabBarIcon(InboxNativeIcon),
    selectedIcon: toTabBarIcon(InboxFilledNativeIcon),
  },
  {
    key: "explore",
    label: "Explore articles",
    icon: toTabBarIcon(AlbumsNativeIcon),
    selectedIcon: toTabBarIcon(AlbumsFilledNativeIcon),
  },
];

const SWITCHER: TabBarSwitcher = {
  label: "Choose source",
  hint: "Opens folders and feeds",
  icon: toTabBarIcon(ChevronsUpDownNativeIcon),
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
