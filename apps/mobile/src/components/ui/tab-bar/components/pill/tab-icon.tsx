import { useCallback, useMemo, type ComponentType } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import {
  COLORS,
  PRIMARY_TAB_ICON_SIZE,
  SELECTOR_TAB_ICON_SIZE,
  PILL_HEIGHT,
  TAB_CENTER_XS,
  TAB_ITEM_HEIGHT,
  TAB_ITEM_RADIUS,
} from "../../lib/constants";

interface TabIconProps {
  readonly glowProgress: SharedValue<number>;
  readonly icon: ComponentType<{ fill?: string; focused?: boolean; size?: number }>;
  readonly index: number;
  readonly isActive: boolean;
  readonly onPress: (index: number) => void;
  readonly pillPressed: SharedValue<number>;
  readonly searchProgress: SharedValue<number>;
  readonly touchX: SharedValue<number>;
  readonly touchY: SharedValue<number>;
  readonly width?: number;
}

export function TabIcon({
  glowProgress,
  icon: Icon,
  index,
  isActive,
  onPress,
  pillPressed,
  searchProgress,
  touchX,
  touchY,
  width,
}: TabIconProps) {
  const triggerHaptic = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handlePress = useCallback(() => {
    onPress(index);
  }, [index, onPress]);

  const tap = useMemo(
    () =>
      Gesture.Tap()
        .onBegin(() => {
          touchX.set(TAB_CENTER_XS[index]);
          touchY.set(PILL_HEIGHT / 2);
          pillPressed.set(withTiming(1, { duration: 80 }));
          cancelAnimation(glowProgress);
          glowProgress.set(1);
        })
        .onFinalize(() => {
          pillPressed.set(withTiming(0, { duration: 150 }));
          glowProgress.set(withTiming(2, { duration: 300 }));
          scheduleOnRN(triggerHaptic);
          scheduleOnRN(handlePress);
        }),
    [glowProgress, handlePress, index, pillPressed, touchX, touchY, triggerHaptic],
  );

  const iconAnimatedStyle = useAnimatedStyle(() => {
    const sp = searchProgress.get();
    if (index === 0) {
      return { opacity: 1, transform: [{ scale: 1 }] };
    }

    return {
      opacity: interpolate(sp, [0, 0.3], [1, 0]),
      transform: [{ scale: interpolate(sp, [0, 0.3], [1, 0.5]) }],
    };
  });

  const iconColor = isActive ? COLORS.iconActive : COLORS.iconDefault;
  const iconSize = index === 2 ? SELECTOR_TAB_ICON_SIZE : PRIMARY_TAB_ICON_SIZE;

  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        style={[styles.container, width ? { flex: 0, width } : null, iconAnimatedStyle]}
      >
        <View style={styles.iconWrapper}>
          <Icon fill={iconColor} focused={isActive} size={iconSize} />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderRadius: TAB_ITEM_RADIUS,
    height: "100%",
    justifyContent: "center",
  },
  iconWrapper: {
    alignItems: "center",
    height: TAB_ITEM_HEIGHT,
    justifyContent: "center",
    width: "100%",
  },
});
