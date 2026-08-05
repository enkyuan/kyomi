import { BlurTargetView } from "expo-blur";
import { useCallback, useRef } from "react";
import { Platform, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAnimatedReaction, useSharedValue } from "react-native-reanimated";
import { HEADER_CONTENT_HEIGHT, Header } from "@ui/header";
import { HeaderSurface } from "@ui/header/surface";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import { RecentHistoryList } from "./components/history-list";

export function RecentsScreen() {
  const insets = useSafeAreaInsets();
  const theme = getMobileSurfaceTheme(useColorScheme());
  const headerHeight = insets.top + HEADER_CONTENT_HEIGHT;
  const contentInsetTop = Platform.OS === "ios" ? headerHeight : 0;
  const scrollY = useSharedValue(-contentInsetTop);
  const headerScrollY = useSharedValue(0);
  const hasUserInteracted = useSharedValue(contentInsetTop === 0);
  const blurTargetRef = useRef<View>(null);

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

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
        <RecentHistoryList
          headerHeight={headerHeight}
          onScrollBeginDrag={handleScrollBeginDrag}
          scrollY={scrollY}
        />
      </BlurTargetView>
      <HeaderSurface
        blurTarget={blurTargetRef}
        scrollY={headerScrollY}
        style={{ left: 0, position: "absolute", right: 0, top: 0 }}
      >
        <Header surface="transparent" title="Recents" />
      </HeaderSurface>
    </View>
  );
}
