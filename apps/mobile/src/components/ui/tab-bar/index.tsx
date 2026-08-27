import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import { KyomiNativeTabBar } from "../../../../modules/tab-bar";
import { CloseSearchButton, SearchButton } from "./components/search";
import { useSearchTab } from "./components/search-tab";
import { TabBarPill } from "./components/pill";
import { usePill } from "./hooks/use-pill";
import { useSearch } from "./hooks/use-search";
import { useAnimation } from "./hooks/use-animation";
import { TAB_BAR_BOTTOM_PADDING, TAB_BAR_HORIZONTAL_PADDING } from "./lib/constants";
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
  const insets = useSafeAreaInsets();
  const { searchRequestId } = useSearchTab();
  const bottomPadding = Math.max(insets.bottom, TAB_BAR_BOTTOM_PADDING);
  const [searchQuery, setSearchQuery] = useState("");
  const lastSearchRequestId = useRef(searchRequestId);

  const currentIndex = state?.index === 1 ? 1 : 0;

  const {
    activeTab,
    isSearchActive,
    pillAnimatedStyle,
    searchProgress,
    setActiveTab,
    toggleSearch,
  } = useAnimation(currentIndex);

  useEffect(() => {
    if (state && state.index !== activeTab && state.index < 2) {
      setActiveTab(state.index);
    }
  }, [state, activeTab, setActiveTab]);

  useEffect(() => {
    if (searchRequestId === lastSearchRequestId.current) {
      return;
    }

    lastSearchRequestId.current = searchRequestId;
    if (!isSearchActive) {
      toggleSearch();
    }
  }, [isSearchActive, searchRequestId, toggleSearch]);

  const handleTabPress = useCallback(
    (index: number) => {
      if (index > 1) {
        return;
      }

      setActiveTab(index);
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
    },
    [navigation, onTabChange, setActiveTab, state],
  );

  const handleSearchQuery = useCallback(
    (query: string) => {
      if (Platform.OS !== "ios") {
        setSearchQuery(query);
      }

      onSearchQueryChange?.(query);
    },
    [onSearchQueryChange],
  );

  const { glowProgress, overflowX, overflowY, panGesture, pillPressed, touchX, touchY } = usePill();

  const {
    composedGesture: searchComposedGesture,
    glowProgress: searchGlowProgress,
    overflowX: searchOverflowX,
    overflowY: searchOverflowY,
    pressed: searchPressed,
    touchX: searchTouchX,
    touchY: searchTouchY,
  } = useSearch(toggleSearch);

  const {
    composedGesture: closeComposedGesture,
    glowProgress: closeGlowProgress,
    overflowX: closeOverflowX,
    overflowY: closeOverflowY,
    pressed: closePressed,
    touchX: closeTouchX,
    touchY: closeTouchY,
  } = useSearch(toggleSearch, false);

  if (Platform.OS === "ios") {
    return (
      <View pointerEvents="box-none" style={styles.nativeContainer}>
        <KyomiNativeTabBar
          activeTab={activeTab === 1 ? "all" : "feeds"}
          minimized={isSearchActive ? false : minimized}
          onSearchClose={toggleSearch}
          onSearchPress={toggleSearch}
          onSearchQueryChange={(event) => handleSearchQuery(event.nativeEvent.query)}
          onSearchSubmit={(event) => onSearchSubmit?.(event.nativeEvent.query)}
          onSelectSource={(event) => onSelectSource?.(event.nativeEvent)}
          onSelectTab={(event) => handleTabPress(event.nativeEvent.tab === "all" ? 1 : 0)}
          searchActive={isSearchActive}
          selectedSourceId={selectedSourceId}
          sources={sources}
          style={StyleSheet.absoluteFill}
        />
      </View>
    );
  }

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.container, { paddingBottom: bottomPadding }]}
    >
      <TabBarPill
        activeTab={activeTab}
        glowProgress={glowProgress}
        onTabPress={handleTabPress}
        overflowX={overflowX}
        overflowY={overflowY}
        panGesture={panGesture}
        pillAnimatedStyle={pillAnimatedStyle}
        pillPressed={pillPressed}
        searchProgress={searchProgress}
        touchX={touchX}
        touchY={touchY}
      />
      <SearchButton
        composedGesture={searchComposedGesture}
        glowProgress={searchGlowProgress}
        isSearchActive={isSearchActive}
        onQueryChange={handleSearchQuery}
        overflowX={searchOverflowX}
        overflowY={searchOverflowY}
        pressed={searchPressed}
        searchProgress={searchProgress}
        touchX={searchTouchX}
        touchY={searchTouchY}
        value={searchQuery}
      />
      <CloseSearchButton
        composedGesture={closeComposedGesture}
        glowProgress={closeGlowProgress}
        overflowX={closeOverflowX}
        overflowY={closeOverflowY}
        pressed={closePressed}
        searchProgress={searchProgress}
        touchX={closeTouchX}
        touchY={closeTouchY}
      />
    </Animated.View>
  );
}

export default TabBar;
export type { TabBarProps };

const styles = StyleSheet.create({
  nativeContainer: {
    bottom: 0,
    height: 120,
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 50,
  },
  container: {
    alignItems: "flex-end",
    bottom: 0,
    flexDirection: "row",
    left: 0,
    paddingHorizontal: TAB_BAR_HORIZONTAL_PADDING,
    position: "absolute",
    right: 0,
    zIndex: 50,
  },
});
