import { useCallback } from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";
import { CollapsingHeader, COMPACT_NAV_HEIGHT } from "@ui/header";
import { ScrollHeaderLayout } from "@ui/header/scroll-layout";
import { RecentHistoryList } from "./components/history-list";

export function RecentsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + COMPACT_NAV_HEIGHT;
  const contentInsetTop = Platform.OS === "ios" ? headerHeight : 0;
  const scrollY = useSharedValue(-contentInsetTop);
  const hasUserInteracted = useSharedValue(contentInsetTop === 0);
  const headerScrollY = useDerivedValue(() => {
    const offset = scrollY.value;

    // Legend List initializes its shared value with logical zero, while an
    // iOS list with a top inset rests at `-contentInsetTop`. Delay header
    // materialization until the user has vertically interacted with the list.
    if (contentInsetTop > 0 && !hasUserInteracted.value) return 0;

    return Math.max(0, offset + contentInsetTop);
  });

  const handleScrollBeginDrag = useCallback(() => {
    hasUserInteracted.set(true);
  }, [hasUserInteracted]);

  const handleScrollReset = useCallback(() => {
    hasUserInteracted.set(contentInsetTop === 0);
  }, [contentInsetTop, hasUserInteracted]);
  return (
    <ScrollHeaderLayout
      header={<CollapsingHeader scrollY={headerScrollY} title="Inbox" />}
      scrollY={headerScrollY}
      title="Inbox"
    >
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
