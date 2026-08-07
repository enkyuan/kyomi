import { BlurView } from "expo-blur";
import { GlassView } from "expo-glass-effect";
import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";

type ActionMenuSurfaceProps = PropsWithChildren<{
  readonly usesLiquidGlass: boolean;
  readonly style?: StyleProp<ViewStyle>;
}>;

/** Native Liquid Glass where available, with the same material fallback as the tab bar. */
export function ActionMenuSurface({ children, style, usesLiquidGlass }: ActionMenuSurfaceProps) {
  if (usesLiquidGlass) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive style={style}>
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView intensity={72} style={style} tint="systemThickMaterialDark">
      {children}
    </BlurView>
  );
}
