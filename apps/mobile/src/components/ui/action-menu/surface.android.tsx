import { BlurView } from "expo-blur";
import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";

type ActionMenuSurfaceProps = PropsWithChildren<{
  readonly usesLiquidGlass: boolean;
  readonly style?: StyleProp<ViewStyle>;
}>;

/** Material fallback for Android, where the menu keeps the same geometry and motion. */
export function ActionMenuSurface({ children, style }: ActionMenuSurfaceProps) {
  return (
    <BlurView intensity={72} style={style} tint="systemThickMaterialDark">
      {children}
    </BlurView>
  );
}
