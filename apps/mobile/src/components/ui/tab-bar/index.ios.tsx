import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { TabBar as NativeTabBar } from "../../../../modules/tab-bar";
import type { TabBarProps } from "./lib/types";

export function TabBar({
  descriptors: _descriptors,
  minimized = false,
  navigation,
  onSearchQueryChange,
  onSearchSubmit,
  onSelectSource,
  onTabChange,
  selectedSourceId,
  sources = [],
  state,
}: TabBarProps) {
  const activeTab = state?.index === 1 ? 1 : 0;
  const [isSearchActive, setIsSearchActive] = useState(false);

  function handleTabPress(index: number) {
    if (index > 1) {
      return;
    }

    onTabChange?.(index);

    if (state && navigation) {
      const route = state.routes[index];
      if (route) {
        const isFocused = state.index === index;
        const event = navigation.emit({
          canPreventDefault: true,
          target: route.key,
          type: "tabPress",
        });

        if (!isFocused && !event.defaultPrevented) {
          navigation.navigate(route.name, route.params);
        }
      }
    }
  }

  return (
    <View className="absolute inset-x-0 bottom-0 h-[120px] z-50" pointerEvents="box-none">
      <NativeTabBar
        activeTab={activeTab === 1 ? "explore" : "feeds"}
        minimized={isSearchActive ? false : minimized}
        onSearchClose={() => setIsSearchActive(false)}
        onSearchPress={() => setIsSearchActive(true)}
        onSearchQueryChange={(event) => onSearchQueryChange?.(event.nativeEvent.query)}
        onSearchSubmit={(event) => onSearchSubmit?.(event.nativeEvent.query)}
        onSelectSource={(event) => onSelectSource?.(event.nativeEvent)}
        onSelectTab={(event) => handleTabPress(event.nativeEvent.tab === "explore" ? 1 : 0)}
        searchActive={isSearchActive}
        selectedSourceId={selectedSourceId}
        sources={sources}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export default TabBar;
export type { TabBarProps };
