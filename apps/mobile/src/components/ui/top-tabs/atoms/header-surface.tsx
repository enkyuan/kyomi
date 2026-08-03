import { BlurView } from "expo-blur";
import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  interpolate,
  Extrapolation,
  useAnimatedProps,
  type SharedValue,
} from "react-native-reanimated";

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

const FADE_IN_DISTANCE_PX = 24;
const MAX_BLUR_INTENSITY = 50;

type HeaderSurfaceProps = PropsWithChildren<{
  scrollY: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
}>;

/**
 * Invisible at rest; fades in a blur as the active page's content scrolls
 * beneath it, mirroring a native large-title scroll-edge effect.
 */
export function HeaderSurface({ children, scrollY, style }: HeaderSurfaceProps) {
  const animatedProps = useAnimatedProps(() => ({
    intensity: interpolate(
      scrollY.get(),
      [0, FADE_IN_DISTANCE_PX],
      [0, MAX_BLUR_INTENSITY],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <AnimatedBlurView animatedProps={animatedProps} style={style} tint="systemThickMaterial">
      {children}
    </AnimatedBlurView>
  );
}
