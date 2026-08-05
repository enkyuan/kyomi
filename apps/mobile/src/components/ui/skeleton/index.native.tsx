import { Skeleton as MotiSkeleton } from "moti/skeleton";
import type { ComponentProps } from "react";
import { useColorScheme, View, type ViewProps } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import { getSkeletonPalette, type HexColor } from "./palette";

type SkeletonProps = Omit<
  ComponentProps<typeof MotiSkeleton>,
  | "backgroundColor"
  | "backgroundSize"
  | "children"
  | "colorMode"
  | "colors"
  | "height"
  | "show"
  | "transition"
  | "width"
> &
  Pick<ViewProps, "className" | "style"> & {
    readonly surfaceColor?: HexColor;
  };

export function Skeleton({ className, style, surfaceColor, ...props }: SkeletonProps) {
  const colorMode = useColorScheme() === "dark" ? "dark" : "light";
  const shouldReduceMotion = useReducedMotion();
  const { background } = getMobileSurfaceTheme(colorMode);
  const palette = getSkeletonPalette(colorMode, surfaceColor ?? background);
  const borderRadius = props.radius === "round" ? 999 : (props.radius ?? 8);

  if (shouldReduceMotion) {
    return (
      <View
        className={`rounded-sm ${className ?? ""}`}
        style={[{ backgroundColor: palette.backgroundColor, borderRadius }, style]}
      />
    );
  }

  return (
    <MotiSkeleton
      backgroundColor={palette.backgroundColor}
      backgroundSize={2}
      colorMode={colorMode}
      colors={palette.colors}
      show
      transition={{
        translateX: {
          delay: 0,
          duration: 2_000,
          loop: true,
          type: "timing",
        },
      }}
      {...props}
    >
      <View
        className={`rounded-sm ${className ?? ""}`}
        style={[{ backgroundColor: palette.backgroundColor }, style]}
      />
    </MotiSkeleton>
  );
}
