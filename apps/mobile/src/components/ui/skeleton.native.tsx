import { Skeleton as MotiSkeleton } from "moti/skeleton";
import type { ComponentProps } from "react";
import { useColorScheme, View, type ViewProps } from "react-native";
import { getMobileSurfaceTheme } from "@/theme/surfaces";

const SKELETON_HIGHLIGHT = {
  dark: "#282828",
  light: "#f9f8f7",
} as const;

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
  Pick<ViewProps, "className" | "style">;

export function Skeleton({ className, style, ...props }: SkeletonProps) {
  const colorMode = useColorScheme() === "dark" ? "dark" : "light";
  const { secondary } = getMobileSurfaceTheme(colorMode);
  const highlight = SKELETON_HIGHLIGHT[colorMode];
  const colors = [secondary, secondary, highlight, secondary, secondary];

  return (
    <MotiSkeleton
      backgroundColor={secondary}
      backgroundSize={2}
      colorMode={colorMode}
      colors={colors}
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
      <View className={`rounded-sm bg-muted ${className ?? ""}`} style={style} />
    </MotiSkeleton>
  );
}
