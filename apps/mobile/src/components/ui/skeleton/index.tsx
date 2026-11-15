import { Skeleton as SkeletonBlock } from "./block";
import { SkeletonLines, SkeletonRepeat } from "./parts";

/**
 * The one skeleton primitive. `Skeleton` is a single placeholder block (animated by Moti on iOS and
 * Android, flat on web: see `block.native.tsx` and `block.tsx`), with the parts every placeholder
 * layout is built from:
 *
 * - `Skeleton.Group` toggles every skeleton under it together.
 * - `Skeleton.Lines` is a stack of text-line bars.
 * - `Skeleton.Repeat` renders a row once per index.
 *
 * Feature screens compose these into their own layout; none draws a block any other way.
 */
export const Skeleton = Object.assign(SkeletonBlock, {
  Lines: SkeletonLines,
  Repeat: SkeletonRepeat,
});

export type { SkeletonLinesProps, SkeletonProps } from "./types";
