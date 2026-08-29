import { BlurView } from "expo-blur";
import type { PropsWithChildren, RefObject } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedProps,
  type SharedValue,
} from "react-native-reanimated";
import { MATERIAL_FULL_PX, MATERIAL_START_PX, MAX_BLUR_INTENSITY } from "./surface.constants";

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

type HeaderSurfaceProps = PropsWithChildren<{
  blurTarget: RefObject<View | null>;
  scrollY: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
}>;

/**
 * iOS system material, driven directly from the consuming screen's scroll value.
 */
export function HeaderSurface({ children, blurTarget, scrollY, style }: HeaderSurfaceProps) {
  const animatedProps = useAnimatedProps(() => ({
    intensity: interpolate(
      scrollY.get(),
      [0, MATERIAL_START_PX, MATERIAL_FULL_PX],
      [0, 0, MAX_BLUR_INTENSITY],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View style={[{ zIndex: 1 }, style]}>
      <AnimatedBlurView
        animatedProps={animatedProps}
        blurTarget={blurTarget}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        tint="systemThickMaterial"
      />
      {children}
    </View>
  );
}
