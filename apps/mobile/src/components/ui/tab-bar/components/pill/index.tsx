import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { InboxIcon, RecentsIcon, SwitcherIcon } from "@/components/icons";
import {
  COLORS,
  ICON_PADDING,
  PILL_HEIGHT,
  PILL_WIDTH,
  SPRING_BOUNCY,
  TAB_ITEM_HEIGHT,
  TAB_ITEM_RADIUS,
  REGULAR_TAB_WIDTH,
  TAB_WIDTHS,
  liquidGlassTransform,
} from "../../lib/constants";
import type { TabBarPillProps } from "../../lib/types";
import { GlassMaterial } from "./glass-material";
import { GlowOverlay } from "./glow-overlay";
import { TabIcon } from "./tab-icon";

const TAB_KEYS = ["inbox", "recents", "sources"] as const;

const TAB_ICONS = [InboxIcon, RecentsIcon, SwitcherIcon];

const HALF_W = PILL_WIDTH / 2;
const HALF_H = PILL_HEIGHT / 2;
const GLOW_SIZE = 200;

function getTabOffset(index: number) {
  return ICON_PADDING + (index < 2 ? index * REGULAR_TAB_WIDTH : REGULAR_TAB_WIDTH * 2);
}

export function TabBarPill({
  activeTab,
  glowProgress,
  onTabPress,
  overflowX,
  overflowY,
  panGesture,
  pillAnimatedStyle,
  pillPressed,
  searchProgress,
  touchX,
  touchY,
}: TabBarPillProps) {
  const indicatorX = useSharedValue(getTabOffset(activeTab));
  const indicatorWidth = useSharedValue(TAB_WIDTHS[activeTab] ?? REGULAR_TAB_WIDTH);

  useEffect(() => {
    indicatorX.set(withSpring(getTabOffset(activeTab), SPRING_BOUNCY));
    indicatorWidth.set(withSpring(TAB_WIDTHS[activeTab] ?? REGULAR_TAB_WIDTH, SPRING_BOUNCY));
  }, [activeTab, indicatorWidth, indicatorX]);

  const slidingIndicatorStyle = useAnimatedStyle(() => {
    const hideFactor = searchProgress.get();
    const isHidden = hideFactor > 0.05;

    return {
      opacity: isHidden ? interpolate(hideFactor, [0.05, 0.25], [1, 0], "clamp") : 1,
      transform: [
        { translateX: indicatorX.get() },
        { scale: isHidden ? interpolate(hideFactor, [0.05, 0.25], [1, 0.8], "clamp") : 1 },
      ],
      width: indicatorWidth.get(),
    };
  });

  const pillGlassStyle = useAnimatedStyle(() =>
    liquidGlassTransform(pillPressed.get(), overflowX.get(), overflowY.get(), HALF_W, HALF_H),
  );

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={pillGlassStyle}>
        <Animated.View style={[styles.pill, pillAnimatedStyle, styles.pillSurface]}>
          <GlassMaterial style={styles.glassMaterial}>
            <View style={styles.iconsRow}>
              {/* Sliding Active Tab Indicator Capsule */}
              <Animated.View style={[styles.slidingIndicator, slidingIndicatorStyle]} />

              {/* Tab Icons */}
              {TAB_ICONS.map((Icon, index) => (
                <TabIcon
                  glowProgress={glowProgress}
                  icon={Icon}
                  index={index}
                  isActive={activeTab === index}
                  key={TAB_KEYS[index]}
                  onPress={onTabPress}
                  pillPressed={pillPressed}
                  searchProgress={searchProgress}
                  touchX={touchX}
                  touchY={touchY}
                  width={TAB_WIDTHS[index]}
                />
              ))}
            </View>
          </GlassMaterial>
          <GlowOverlay
            glowProgress={glowProgress}
            id="pillGlow"
            size={GLOW_SIZE}
            touchX={touchX}
            touchY={touchY}
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  glassMaterial: {
    alignSelf: "stretch",
    flex: 1,
    minWidth: 0,
  },
  iconsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 0,
    height: PILL_HEIGHT,
    paddingHorizontal: ICON_PADDING,
    paddingVertical: 4,
    position: "relative",
  },
  pill: {
    justifyContent: "flex-start",
  },
  pillSurface: {
    overflow: "hidden",
  },
  slidingIndicator: {
    backgroundColor: COLORS.surfaceHover,
    borderRadius: TAB_ITEM_RADIUS,
    height: TAB_ITEM_HEIGHT,
    left: 0,
    position: "absolute",
    top: 4,
    width: REGULAR_TAB_WIDTH,
    zIndex: 0,
  },
});
