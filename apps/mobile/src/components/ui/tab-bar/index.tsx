import { useEffect, useRef, useState } from "react";
import { Keyboard, StyleSheet, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import { CloseSearchButton, SearchButton } from "./components/search";
import { TabBarPill } from "./components/pill";
import { useAnimation } from "./hooks/use-animation";
import { usePill } from "./hooks/use-pill";
import { useSearch } from "./hooks/use-search";
import { useKeyboard } from "@hooks/use-keyboard";
import { TAB_BAR_BOTTOM_PADDING, TAB_BAR_HORIZONTAL_PADDING } from "./lib/constants";
import type { TabBarProps } from "./lib/types";

export function TabBar({
  descriptors: _descriptors,
  minimized: _minimized = false,
  navigation,
  onSearchQueryChange,
  onSearchSubmit,
  onSelectSource: _onSelectSource,
  onTabChange,
  selectedSourceId: _selectedSourceId,
  sources: _sources = [],
  state,
}: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { height: keyboardHeight } = useKeyboard();
  const bottomPadding = Math.max(insets.bottom, TAB_BAR_BOTTOM_PADDING);
  const bottomInset = keyboardHeight > 0 ? TAB_BAR_BOTTOM_PADDING : bottomPadding;
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<TextInput>(null);

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
    if (!isSearchActive) {
      searchInputRef.current?.blur();
      Keyboard.dismiss();
      return;
    }

    const focusFrame = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(focusFrame);
  }, [isSearchActive]);

  useEffect(() => {
    if (state && state.index !== activeTab && state.index < 2) {
      setActiveTab(state.index);
    }
  }, [state, activeTab, setActiveTab]);

  function handleTabPress(index: number) {
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
  }

  function handleSearchQuery(query: string) {
    setSearchQuery(query);
    onSearchQueryChange?.(query);
  }

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

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.container, { bottom: keyboardHeight, paddingBottom: bottomInset }]}
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
        inputRef={searchInputRef}
        isSearchActive={isSearchActive}
        onQueryChange={handleSearchQuery}
        onQuerySubmit={onSearchSubmit}
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
  container: {
    alignItems: "flex-end",
    bottom: 0,
    flexDirection: "row",
    justifyContent: "center",
    left: 0,
    paddingHorizontal: TAB_BAR_HORIZONTAL_PADDING,
    position: "absolute",
    right: 0,
    zIndex: 50,
  },
});
