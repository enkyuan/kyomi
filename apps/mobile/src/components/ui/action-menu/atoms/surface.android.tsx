import { BlurView } from "expo-blur";
import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";

type ActionMenuSurfaceProps = PropsWithChildren<{
  readonly tintColor?: string;
  readonly usesLiquidGlass: boolean;
  readonly style?: StyleProp<ViewStyle>;
}>;

/** Material fallback that preserves the same pill geometry on Android. */
export function ActionMenuSurface({ children, style, tintColor }: ActionMenuSurfaceProps) {
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
