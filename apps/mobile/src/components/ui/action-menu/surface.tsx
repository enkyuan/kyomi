import type { PropsWithChildren } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

type ActionMenuSurfaceProps = PropsWithChildren<{
  readonly usesLiquidGlass: boolean;
  readonly style?: StyleProp<ViewStyle>;
}>;

export function ActionMenuSurface({ children, style }: ActionMenuSurfaceProps) {
  return <View style={style}>{children}</View>;
}
