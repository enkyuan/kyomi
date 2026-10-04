import { useMemo } from "react";
import type { TransitionProps } from "@kyomi/ui/transition";

export type UseTransitionOptions = Omit<TransitionProps, "children">;

export function useTransition(options: UseTransitionOptions): UseTransitionOptions {
  const {
    axis,
    className,
    contentClassName,
    contentKey,
    direction,
    features,
    layoutGroupId,
    mode,
    offset,
    transition,
  } = options;

  return useMemo(
    () => ({
      axis,
      className,
      contentClassName,
      contentKey,
      direction,
      features,
      layoutGroupId,
      mode,
      offset,
      transition,
    }),
    [
      axis,
      className,
      contentClassName,
      contentKey,
      direction,
      features,
      layoutGroupId,
      mode,
      offset,
      transition,
    ],
  );
}
