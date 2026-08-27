import { useCallback, useState } from "react";
import { Keyboard } from "react-native";
import { interpolate, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { PILL_BORDER_RADIUS, PILL_HEIGHT, PILL_WIDTH, SPRING, TAB_BAR_GAP } from "../lib/constants";

export function useAnimation(initialTab = 0) {
  const searchProgress = useSharedValue(0);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isSearchActive, setIsSearchActive] = useState(false);

  const toggleSearch = useCallback(() => {
    const opening = searchProgress.get() < 0.5;
    if (!opening) {
      Keyboard.dismiss();
    }
    searchProgress.set(withSpring(opening ? 1 : 0, SPRING));
    setIsSearchActive(opening);
  }, [searchProgress]);

  const pillAnimatedStyle = useAnimatedStyle(() => {
    const sp = searchProgress.get();
    return {
      borderRadius: PILL_BORDER_RADIUS,
      height: PILL_HEIGHT,
      marginRight: interpolate(sp, [0, 0.6], [TAB_BAR_GAP, 0], "clamp"),
      opacity: interpolate(sp, [0, 0.3], [1, 0], "clamp"),
      transform: [{ translateX: interpolate(sp, [0, 0.6], [0, -PILL_WIDTH * 0.3], "clamp") }],
      width: interpolate(sp, [0, 0.6], [PILL_WIDTH, 0], "clamp"),
    };
  });

  return {
    activeTab,
    isSearchActive,
    pillAnimatedStyle,
    searchProgress,
    setActiveTab,
    toggleSearch,
  };
}
