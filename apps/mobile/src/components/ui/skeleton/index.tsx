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
  const block =
    (show ?? group ?? !children) ? (
      <SkeletonBlock
        backgroundColor={backgroundColor}
        covers={Boolean(children)}
        height={height}
        radius={radius}
        width={width}
      />
    ) : null;

  return children ? (
    <View>
      {children}
      {block}
    </View>
  ) : (
    block
  );
}

type SkeletonBlockProps = Pick<SkeletonProps, "height" | "radius" | "width"> & {
  readonly backgroundColor: string;
  /** Laid over children instead of standing in for them. */
  readonly covers: boolean;
};

function SkeletonBlock({ backgroundColor, covers, height, radius = 8, width }: SkeletonBlockProps) {
  const fallbackSize = covers ? "100%" : DEFAULT_SIZE;

  return (
    <View
      pointerEvents="none"
      style={{
        backgroundColor,
        borderRadius: toBorderRadius(radius),
        height: height ?? fallbackSize,
        position: covers ? "absolute" : "relative",
        width: width ?? fallbackSize,
      }}
    />
  );
}

function toBorderRadius(radius: NonNullable<SkeletonProps["radius"]>) {
  if (radius === "round") return 99_999;
  return radius === "square" ? 0 : radius;
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
