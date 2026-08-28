import { LiquidGlassView, isLiquidGlassSupported } from "@callstack/liquid-glass";
import { useMemo, type ReactNode } from "react";
import { StyleSheet, View, useColorScheme, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  type AnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

interface GlassMaterialProps {
  readonly children: ReactNode;
  readonly style?:
    | StyleProp<ViewStyle>
    | AnimatedStyle<ViewStyle>
    | (StyleProp<ViewStyle> | AnimatedStyle<ViewStyle>)[];
  readonly borderRadius?: number | SharedValue<number>;
}

const FALLBACK_SURFACE_LIGHT = "rgba(245,245,247,0.88)";
const FALLBACK_SURFACE_DARK = "rgba(36,36,36,0.96)";

export function GlassMaterial({ children, style, borderRadius = 32 }: GlassMaterialProps) {
  const colorScheme = useColorScheme();
  const isAnimated = typeof borderRadius === "object" && "get" in borderRadius;
  const staticRadius = isAnimated ? undefined : borderRadius;
  const fallbackSurface = colorScheme === "light" ? FALLBACK_SURFACE_LIGHT : FALLBACK_SURFACE_DARK;
  const fill = useMemo(
    () => [StyleSheet.absoluteFill, { borderRadius: staticRadius, overflow: "hidden" as const }],
    [staticRadius],
  );
  const animatedOuter = useAnimatedStyle(() =>
    isAnimated
      ? { borderRadius: (borderRadius as SharedValue<number>).get(), overflow: "hidden" as const }
      : {},
  );

  return (
    <Animated.View
      collapsable={false}
      style={[
        {
          borderRadius: staticRadius,
          overflow: "hidden",
          backgroundColor: isLiquidGlassSupported ? "transparent" : fallbackSurface,
        },
        isAnimated && animatedOuter,
        style as StyleProp<ViewStyle>,
      ]}
    >
      {isLiquidGlassSupported ? (
        <LiquidGlassView effect="regular" interactive style={fill} />
      ) : (
        <View style={fill} />
      )}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {children}
      </View>
    </Animated.View>
  );
}
