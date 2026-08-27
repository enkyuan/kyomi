import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useMemo, type ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
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

export function GlassMaterial({ children, style, borderRadius = 32 }: GlassMaterialProps) {
  const isAnimated = typeof borderRadius === "object" && "get" in borderRadius;
  const staticRadius = isAnimated ? undefined : borderRadius;

  const hasLiquidGlass = useMemo(() => Platform.OS === "ios" && isLiquidGlassAvailable(), []);

  const fill = useMemo(
    () => [StyleSheet.absoluteFill, { borderRadius: staticRadius, overflow: "hidden" as const }],
    [staticRadius],
  );

  const animatedOuter = useAnimatedStyle(() => {
    if (!isAnimated) return {};
    return {
      borderRadius: (borderRadius as SharedValue<number>).get(),
      overflow: "hidden" as const,
    };
  });

  return (
    <Animated.View
      collapsable={false}
      style={[
        {
          borderRadius: staticRadius,
          overflow: "hidden",
        },
        isAnimated && animatedOuter,
        style as StyleProp<ViewStyle>,
      ]}
    >
      {hasLiquidGlass ? (
        <GlassView glassEffectStyle="regular" isInteractive style={fill} />
      ) : (
        <BlurView
          intensity={Platform.OS === "ios" ? 75 : 50}
          style={fill}
          tint="systemUltraThinMaterialDark"
        />
      )}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {children}
      </View>
    </Animated.View>
  );
}
