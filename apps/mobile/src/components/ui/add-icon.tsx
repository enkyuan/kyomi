import { useEffect } from "react";
import type { ColorValue } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { PlusIcon } from "@/components/icons";

const ROTATION_DURATION = 220;
const ROTATION_EASING = Easing.bezier(0.2, 0, 0, 1);

/** The Add action's plus-to-close affordance, shared by both tab bar renderers. */
export function AddCloseIcon({
  active,
  color,
  shouldReduceMotion,
  size = 19,
}: {
  readonly active: boolean;
  readonly color: ColorValue;
  readonly shouldReduceMotion: boolean;
  readonly size?: number;
}) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    const target = active ? 45 : 0;
    rotation.value = shouldReduceMotion
      ? target
      : withTiming(target, { duration: ROTATION_DURATION, easing: ROTATION_EASING });
  }, [active, rotation, shouldReduceMotion]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={iconStyle}>
      <PlusIcon fill={color} size={size} />
    </Animated.View>
  );
}
