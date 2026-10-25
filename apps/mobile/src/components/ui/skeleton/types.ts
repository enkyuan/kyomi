import type { ReactElement } from "react";
import type { DimensionValue } from "react-native";
import type { Skeleton as MotiSkeleton } from "moti/skeleton";
import type { HexColor, SkeletonColorMode } from "./palette";

/**
 * Moti's skeleton props, so docs for `moti/skeleton` apply as written. `surfaceColor` is Kyomi's
 * only addition: the surface the placeholder sits on, which the shimmer layers are composited over.
 */
export type SkeletonProps = {
  /** Content the skeleton stands in for. With children it hides once they exist, unless `show` is set. */
  readonly children?: ReactElement | null;
  readonly colorMode?: SkeletonColorMode;
  /** Milliseconds before the shimmer starts moving. */
  readonly delay?: number;
  readonly height?: DimensionValue;
  /** `round` is a circle, `square` has no rounding, a number is a custom radius. Defaults to `8`. */
  readonly radius?: number | "round" | "square";
  readonly show?: boolean;
  readonly surfaceColor?: HexColor;
  /** Overrides the shimmer's `translateX` animation. Replaces Kyomi's default as a whole. */
  readonly transition?: Parameters<typeof MotiSkeleton>[0]["transition"];
  readonly width?: DimensionValue;
};
