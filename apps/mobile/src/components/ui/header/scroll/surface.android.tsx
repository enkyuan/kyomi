import { BlurView } from "expo-blur";
import type { PropsWithChildren, RefObject } from "react";
import { StyleSheet, useColorScheme, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import { MATERIAL_FULL_PX, MATERIAL_START_PX, MAX_BLUR_INTENSITY } from "./surface.constants";

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);
const MAX_FALLBACK_TINT_OPACITY = 0.68;

type HeaderSurfaceProps = PropsWithChildren<{
  blurTarget: RefObject<View | null>;
  scrollY: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
}>;

/**
 * Android uses the same normalized underlap as iOS. API 31+ receives a native
 * backdrop blur; older devices retain the matching tonal Material fallback.
 */
export function HeaderSurface({ children, blurTarget, scrollY, style }: HeaderSurfaceProps) {
  const { background } = getMobileSurfaceTheme(useColorScheme());
  const animatedProps = useAnimatedProps(() => ({
    intensity: interpolate(
      scrollY.get(),
      [0, MATERIAL_START_PX, MATERIAL_FULL_PX],
      [0, 0, MAX_BLUR_INTENSITY],
      Extrapolation.CLAMP,
    ),
  }));
  const surfaceStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.get(),
      [0, MATERIAL_START_PX, MATERIAL_FULL_PX],
      [0, 0, MAX_FALLBACK_TINT_OPACITY],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View style={[{ boxShadow: "0 1px 2px rgba(0, 0, 0, 0.12)", zIndex: 1 }, style]}>
      <AnimatedBlurView
        animatedProps={animatedProps}
        blurMethod="dimezisBlurViewSdk31Plus"
        blurReductionFactor={2}
        blurTarget={blurTarget}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        tint="default"
      />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: background }, surfaceStyle]}
      />
      {children}
    </View>
  );
}
