import type { PropsWithChildren } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

type ActionMenuSurfaceProps = PropsWithChildren<{
  readonly tintColor?: string;
  readonly usesLiquidGlass: boolean;
  readonly style?: StyleProp<ViewStyle>;
}>;

export function ActionMenuSurface({ children, style, tintColor }: ActionMenuSurfaceProps) {
  return (
    <View style={[style, tintColor ? { backgroundColor: tintColor } : undefined]}>{children}</View>
  );
}
