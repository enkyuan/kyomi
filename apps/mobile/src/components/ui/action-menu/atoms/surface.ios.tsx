import { BlurView } from "expo-blur";
import { GlassView } from "expo-glass-effect";
import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";

type ActionMenuSurfaceProps = PropsWithChildren<{
  /** A native glass tint, not an opaque overlay, so refraction remains visible. */
  readonly tintColor?: string;
  readonly usesLiquidGlass: boolean;
  readonly style?: StyleProp<ViewStyle>;
}>;

/** Native Liquid Glass where available, with the same material fallback as the tab bar. */
export function ActionMenuSurface({
  children,
  style,
  tintColor,
  usesLiquidGlass,
}: ActionMenuSurfaceProps) {
  if (usesLiquidGlass) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive style={style} tintColor={tintColor}>
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView
      intensity={72}
      style={[style, tintColor ? { backgroundColor: tintColor } : undefined]}
      tint="systemThickMaterialDark"
    >
      {children}
    </BlurView>
  );
}
