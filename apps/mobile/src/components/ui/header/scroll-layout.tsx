import { BlurTargetView } from "expo-blur";
import { useRef, type ReactNode, type RefObject } from "react";
import { View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SharedValue } from "react-native-reanimated";
import { Header, TITLE_CONTENT_HEIGHT } from "@ui/header";
import { HeaderSurface } from "@ui/header/surface";
import { getMobileSurfaceTheme } from "@/theme/surfaces";

type ScrollHeaderLayoutProps = {
  title: string;
  /**
   * Driven by the consuming screen so the material stays synced to whatever
   * scrollable it owns (a plain ScrollView, a LegendList with a top inset, …).
   */
  scrollY: SharedValue<number>;
  /** Total header height including the safe-area inset, for content padding. */
  children: (args: { blurTarget: RefObject<View | null>; headerHeight: number }) => ReactNode;
};

/**
 * Shared chrome for a scroll-linked material header: the blur target, the
 * floating HeaderSurface, and the safe-area geometry. Recents and Settings
 * compose this so the header can't drift between them; each screen still owns
 * its own scroll model (the part that legitimately differs) via `scrollY`.
 */
export function ScrollHeaderLayout({ children, scrollY, title }: ScrollHeaderLayoutProps) {
  const insets = useSafeAreaInsets();
  const theme = getMobileSurfaceTheme(useColorScheme());
  const headerHeight = insets.top + TITLE_CONTENT_HEIGHT;
  const blurTarget = useRef<View>(null);

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <BlurTargetView ref={blurTarget} style={{ flex: 1 }}>
        {children({ blurTarget, headerHeight })}
      </BlurTargetView>
      <HeaderSurface
        blurTarget={blurTarget}
        scrollY={scrollY}
        style={{ left: 0, position: "absolute", right: 0, top: 0 }}
      >
        <Header surface="transparent" title={title} />
      </HeaderSurface>
    </View>
  );
}
