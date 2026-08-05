import { useEffect } from "react";
import { Platform, Pressable } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { styles } from "../lib/styles";
import type { AnimatedTabProps } from "../lib/types";

const ACTIVE_COLOR = "#a8d480";

export function AnimatedTab({
  isFocused,
  options,
  colors,
  accessibilityLabel,
  onPress,
  onLongPress,
  showsActiveColor = true,
  shouldReduceMotion,
  testID,
}: AnimatedTabProps) {
  const focus = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    if (shouldReduceMotion) {
      focus.set(isFocused ? 1 : 0);
      return;
    }

    focus.set(
      withTiming(isFocused ? 1 : 0, {
        duration: 300,
        easing: Easing.out(Easing.ease),
      }),
    );
  }, [focus, isFocused, shouldReduceMotion]);

  const animatedBackgroundStyle = useAnimatedStyle(() => ({
    opacity: interpolate(focus.value, [0, 1], [0, 1]),
    transform: [{ scale: interpolate(focus.value, [0, 1], [0.8, 1]) }],
  }));

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={Platform.OS === "ios" ? "button" : "tab"}
      accessibilityState={{ selected: isFocused }}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
      testID={testID}
    >
      <Animated.View style={[styles.tabBackground, animatedBackgroundStyle]} />
      {options.tabBarIcon?.({
        focused: isFocused,
        color: isFocused && showsActiveColor ? ACTIVE_COLOR : String(colors.text),
        size: 24,
      })}
    </Pressable>
  );
}
