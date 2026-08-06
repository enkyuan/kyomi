import { Skeleton as MotiSkeleton } from "moti/skeleton";
import type { ComponentProps } from "react";
import { StyleSheet, useColorScheme, View, type ViewProps } from "react-native";
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
  const frameStyle = StyleSheet.flatten(style);

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
      // Moti paints its shimmer in an absolute sibling. Its container stretches by
      // default, so article skeleton widths applied only to the child were painted
      // as full-width rows. Give the shimmer the same explicit geometry as the
      // placeholder content.
      height={frameStyle?.height}
      show
      transition={{
        translateX: {
          delay: 0,
          duration: 2_000,
          loop: true,
          type: "timing",
        },
      }}
      width={frameStyle?.width}
      {...props}
    >
      <View
        className={`rounded-sm ${className ?? ""}`}
        style={[{ backgroundColor: palette.backgroundColor }, style]}
      />
    </MotiSkeleton>
  );
}
