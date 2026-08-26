import { useCallback } from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAnimatedReaction, useSharedValue } from "react-native-reanimated";
import { TITLE_CONTENT_HEIGHT } from "@ui/header";
import { ScrollHeaderLayout } from "@ui/header/scroll-layout";
import { RecentHistoryList } from "./components/history-list";

export function RecentsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + TITLE_CONTENT_HEIGHT;
  const contentInsetTop = Platform.OS === "ios" ? headerHeight : 0;
  const scrollY = useSharedValue(-contentInsetTop);
  const headerScrollY = useSharedValue(0);
  const hasUserInteracted = useSharedValue(contentInsetTop === 0);

  useAnimatedReaction(
    () => {
      const offset = scrollY.value;

      // Legend List initializes its shared value with logical zero, while an
      // iOS list with a top inset rests at `-contentInsetTop`. Delay header
      // materialization until the user has vertically interacted with the list.
      if (contentInsetTop > 0 && !hasUserInteracted.value) return 0;

      return Math.max(0, offset + contentInsetTop);
    },
    (offset) => {
      headerScrollY.value = offset;
    },
  );

  const handleScrollBeginDrag = useCallback(() => {
    hasUserInteracted.set(true);
  }, [hasUserInteracted]);

  const handleScrollReset = useCallback(() => {
    hasUserInteracted.set(contentInsetTop === 0);
  }, [contentInsetTop, hasUserInteracted]);

  return (
    <ScrollHeaderLayout scrollY={headerScrollY} title="Recents">
      {() => (
        <RecentHistoryList
          headerHeight={headerHeight}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScrollReset={handleScrollReset}
          scrollY={scrollY}
        />
      )}
    </ScrollHeaderLayout>
  );
}
