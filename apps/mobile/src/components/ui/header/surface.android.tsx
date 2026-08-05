import { BlurView } from "expo-blur";
import type { PropsWithChildren, RefObject } from "react";
import { useColorScheme, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { getMobileSurfaceTheme } from "@/theme/surfaces";

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

const MATERIAL_START_PX = 4;
const MATERIAL_FULL_PX = 16;
const MAX_BLUR_INTENSITY = 50;
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
    <View style={[{ elevation: 1, zIndex: 1 }, style]}>
      <AnimatedBlurView
        animatedProps={animatedProps}
        blurMethod="dimezisBlurViewSdk31Plus"
        blurReductionFactor={2}
        blurTarget={blurTarget}
        pointerEvents="none"
        style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
        tint="default"
      />
      <Animated.View
        pointerEvents="none"
        style={[
          {
            backgroundColor: background,
            bottom: 0,
            left: 0,
            position: "absolute",
            right: 0,
            top: 0,
          },
          surfaceStyle,
        ]}
      />
      {children}
    </View>
  );
}
