import { useCallback } from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";
import { CollapsingHeader, COMPACT_NAV_HEIGHT } from "@ui/header";
import { ScrollHeaderLayout } from "@ui/header/scroll-layout";
import { RecentList } from "./components/list";

type RecentsScreenProps = {
  /** Renders the large-title collapsing header. Set to `false` when a
   *  native Stack header already owns the title (e.g. pushed inside
   *  another screen's modal). Defaults to `true` for the tab usage. */
  readonly showHeader?: boolean;
  readonly title?: string;
};

export function RecentsScreen({ showHeader = true, title = "Inbox" }: RecentsScreenProps = {}) {
  const insets = useSafeAreaInsets();
  const headerHeight = showHeader ? insets.top + COMPACT_NAV_HEIGHT : 0;
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
      header={showHeader ? <CollapsingHeader scrollY={headerScrollY} title={title} /> : <></>}
      scrollY={headerScrollY}
      title={title}
    >
      {() => (
        <RecentList
          headerHeight={headerHeight}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScrollReset={handleScrollReset}
          scrollY={scrollY}
        />
      )}
    </ScrollHeaderLayout>
  );
}
