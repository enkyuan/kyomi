import { BlurView } from "expo-blur";
import { GlassView } from "expo-glass-effect";
import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";

type ActionMenuSurfaceProps = PropsWithChildren<{
  readonly usesLiquidGlass: boolean;
  readonly style?: StyleProp<ViewStyle>;
}>;

/** Uses native interactive Liquid Glass when the device and accessibility settings allow it. */
export function ActionMenuSurface({ children, style, usesLiquidGlass }: ActionMenuSurfaceProps) {
  if (usesLiquidGlass) {
    return (
      <GlassView
        glassEffectStyle={{ animate: true, animationDuration: 0.18, style: "regular" }}
        isInteractive
        style={style}
      >
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
