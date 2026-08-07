import { type PropsWithChildren } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { ScrollHeaderLayout } from "@ui/header/scroll-layout";
import { getTabBarOcclusionHeight } from "@ui/tab-bar/lib/styles";

/**
 * Keeps Settings' native content beneath the same scroll-linked material
 * header used by the inbox and Recents, via the shared ScrollHeaderLayout.
 */
export function SettingsScreenLayout({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = Math.max(0, event.contentOffset.y);
    },
  });

  return (
    <ScrollHeaderLayout scrollY={scrollY} title="Settings">
      {({ headerHeight }) => (
        <Animated.ScrollView
          contentContainerStyle={{
            paddingBottom: getTabBarOcclusionHeight(insets),
            paddingTop: headerHeight,
          }}
          contentInsetAdjustmentBehavior="never"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </Animated.ScrollView>
      )}
    </ScrollHeaderLayout>
  );
}
