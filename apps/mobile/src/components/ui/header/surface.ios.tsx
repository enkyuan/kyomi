import { BlurView } from "expo-blur";
import type { PropsWithChildren, RefObject } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedProps,
  type SharedValue,
} from "react-native-reanimated";

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

const MATERIAL_START_PX = 4;
const MATERIAL_FULL_PX = 16;
const MAX_BLUR_INTENSITY = 50;

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
        style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
        tint="systemThickMaterial"
      />
      {children}
    </View>
  );
}
