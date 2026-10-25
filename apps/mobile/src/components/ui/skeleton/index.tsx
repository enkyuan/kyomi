import { createContext, useContext, type ReactNode } from "react";
import { useColorScheme, View } from "react-native";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import { getSkeletonPalette } from "./palette";
import type { SkeletonProps } from "./types";

const DEFAULT_SIZE = 32;

const SkeletonGroupContext = createContext<boolean | undefined>(undefined);

/**
 * Moti pulls a Framer Motion CommonJS interop path that Expo Router cannot evaluate during static
 * web rendering. Native keeps the animated Moti skeleton (`index.native.tsx`); this module is the
 * SSR-safe web placeholder with the same props: a flat block, no shimmer.
 */
export function Skeleton({
  children,
  colorMode: colorModeProp,
  height,
  radius = 8,
  show,
  surfaceColor,
  width,
}: SkeletonProps) {
  const group = useContext(SkeletonGroupContext);
  const scheme = useColorScheme();
  const colorMode = colorModeProp ?? (scheme === "dark" ? "dark" : "light");
  const { background } = getMobileSurfaceTheme(colorMode);
  const { backgroundColor } = getSkeletonPalette(colorMode, surfaceColor ?? background);
  const visible = show ?? group ?? !children;
  const borderRadius = radius === "round" ? 99_999 : radius === "square" ? 0 : radius;
  const block = visible ? (
    <View
      pointerEvents="none"
      style={{
        backgroundColor,
        borderRadius,
        height: height ?? (children ? "100%" : DEFAULT_SIZE),
        position: children ? "absolute" : "relative",
        width: width ?? (children ? "100%" : DEFAULT_SIZE),
      }}
    />
  ) : null;

  if (!children) return block;

  return (
    <View>
      {children}
      {block}
    </View>
  );
}

Skeleton.Group = function SkeletonGroup({
  children,
  show,
}: {
  readonly children: ReactNode;
  readonly show: boolean;
}) {
  return <SkeletonGroupContext.Provider value={show}>{children}</SkeletonGroupContext.Provider>;
};
