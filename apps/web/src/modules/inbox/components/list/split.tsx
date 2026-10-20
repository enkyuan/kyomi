"use client";

import { Button } from "@kyomi/ui/components/button";
import { cn } from "@kyomi/ui/lib/utils";
import type { ComponentProps } from "react";

/**
 * One segment of a split `ButtonGroup`. The group sets `--split-h` (its height) and `--split-fill`
 * (the segments' shared background); the segment inherits the host's text colour.
 *
 * Outer ends are a fixed half-height radius, not `rounded-full`: a huge radius beside the 6px split
 * radius on the same side makes the browser scale every corner down and flattens the split. A
 * segment must be at least outer + 6px wide. `MenuTrigger` overwrites `data-slot="button"`, which
 * the group uses to shape its children, so it is set again last.
 */
export function SplitSegment({
  className,
  edge,
  ...props
}: Omit<ComponentProps<typeof Button>, "variant" | "size"> & { edge: "start" | "end" }) {
  return (
    <Button
      className={cn(
        "h-(--split-h) bg-(--split-fill) text-base text-inherit transition-[color,background-color,box-shadow] hover:bg-(--split-fill) in-data-active:shadow-sm/8 in-data-split-active:shadow-sm/8 data-pressed:bg-(--split-fill) sm:h-(--split-h) sm:text-base",
        edge === "start"
          ? "rounded-s-[calc(var(--split-h)/2)]! rounded-e-[6px]!"
          : "rounded-s-[6px]! rounded-e-[calc(var(--split-h)/2)]!",
        className,
      )}
      static
      variant="ghost"
      {...props}
      data-slot="button"
    />
  );
}
