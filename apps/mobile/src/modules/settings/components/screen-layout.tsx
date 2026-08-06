import { BlurTargetView } from "expo-blur";
import { useRef, type PropsWithChildren } from "react";
import { View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { HEADER_CONTENT_HEIGHT, Header } from "@ui/header";
import { HeaderSurface } from "@ui/header/surface";
import { getTabBarOcclusionHeight } from "@ui/tab-bar/lib/styles";
import { getMobileSurfaceTheme } from "@/theme/surfaces";

/**
 * Keeps Settings' native content beneath the same scroll-linked material
 * header used by the inbox and Recents. The surface, not each screen variant,
 * owns safe-area geometry and header presentation.
 */
export function SettingsScreenLayout({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const theme = getMobileSurfaceTheme(useColorScheme());
  const headerHeight = insets.top + HEADER_CONTENT_HEIGHT;
  const blurTargetRef = useRef<View>(null);
  const scrollY = useSharedValue(0);
  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = Math.max(0, event.contentOffset.y);
    },
  });

  return (
    <View style={{ backgroundColor: theme.background, flex: 1 }}>
      <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
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
      </BlurTargetView>
      <HeaderSurface
        blurTarget={blurTargetRef}
        scrollY={scrollY}
        style={{ left: 0, position: "absolute", right: 0, top: 0 }}
      >
        <Header surface="transparent" title="Settings" />
      </HeaderSurface>
    </View>
  );
}
