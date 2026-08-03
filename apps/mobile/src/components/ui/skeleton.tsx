import { useColorScheme, View, type ViewProps } from "react-native";
import { getMobileSurfaceTheme } from "@/theme/surfaces";

type SkeletonProps = Pick<ViewProps, "className" | "style"> & {
  readonly radius?: number | "round";
};

/**
 * Moti pulls a Framer Motion CommonJS interop path that Expo Router cannot
 * evaluate during static web rendering. Native keeps the animated Moti
 * implementation; this base module is the SSR-safe web loading placeholder.
 */
export function Skeleton({ className, radius = 4, style }: SkeletonProps) {
  const colorMode = useColorScheme() === "dark" ? "dark" : "light";
  const { secondary } = getMobileSurfaceTheme(colorMode);
  const borderRadius = radius === "round" ? 999 : radius;

  return (
    <View
      className={`rounded-sm ${className ?? ""}`}
      style={[{ backgroundColor: secondary, borderRadius }, style]}
    />
  );
}
