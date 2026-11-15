import { Skeleton as MotiSkeleton } from "moti/skeleton";
import { useColorScheme } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import { getSkeletonPalette } from "./palette";
import type { SkeletonProps } from "./types";

const SHIMMER_DURATION_MS = 2_000;

/**
 * Moti's animated skeleton, coloured from Kyomi's surface palette. Reduced motion keeps the flat
 * placeholder: the gradient collapses to one colour and no longer loops.
 */
export function Skeleton({
  colorMode: colorModeProp,
  delay = 0,
  surfaceColor,
  transition,
  ...props
}: SkeletonProps) {
  const scheme = useColorScheme();
  const shouldReduceMotion = useReducedMotion();
  const colorMode = colorModeProp ?? (scheme === "dark" ? "dark" : "light");
  const { background } = getMobileSurfaceTheme(colorMode);
  const { backgroundColor, colors } = getSkeletonPalette(colorMode, surfaceColor ?? background);

  return (
    <MotiSkeleton
      backgroundColor={backgroundColor}
      backgroundSize={2}
      colorMode={colorMode}
      colors={shouldReduceMotion ? [backgroundColor, backgroundColor] : colors}
      transition={{
        translateX: {
          delay,
          duration: SHIMMER_DURATION_MS,
          loop: !shouldReduceMotion,
          type: "timing",
        },
        ...transition,
      }}
      {...props}
    />
  );
}

Skeleton.Group = MotiSkeleton.Group;
