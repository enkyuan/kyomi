/* oxlint-disable react-doctor/only-export-components */
"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cva, type VariantProps } from "class-variance-authority";
import type React from "react";
import { cn } from "../lib/utils";

export const toggleVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-medium text-base text-foreground outline-none transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-var(--stroke-width))] pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-(--touch-target-min) pointer-coarse:after:min-w-(--touch-target-min) hover:bg-accent focus-visible:ring-(length:--focus-ring-width) focus-visible:ring-ring focus-visible:ring-offset-(length:--focus-ring-offset) focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-(--opacity-disabled) data-pressed:bg-input/64 data-pressed:text-accent-foreground sm:text-sm [&_svg:not([class*='opacity-'])]:opacity-(--opacity-icon) [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default:
          "h-(--control-md) min-w-(--control-md) px-[calc(--spacing(2)-var(--stroke-width))] sm:h-(--control-sm) sm:min-w-(--control-sm)",
        lg: "h-(--control-lg) min-w-(--control-lg) px-[calc(--spacing(2.5)-var(--stroke-width))] sm:h-(--control-md) sm:min-w-(--control-md)",
        sm: "h-(--control-sm) min-w-(--control-sm) px-[calc(--spacing(1.5)-var(--stroke-width))] sm:h-(--control-xs) sm:min-w-(--control-xs)",
      },
      variant: {
        default: "border-transparent",
        outline:
          "border-input bg-background not-dark:bg-clip-padding shadow-xs/5 not-disabled:not-active:not-data-pressed:before:shadow-(--shadow-edge-raised) dark:bg-input/32 dark:data-pressed:bg-input dark:hover:bg-input/64 dark:not-disabled:not-active:not-data-pressed:before:shadow-(--shadow-edge-highlight) dark:not-disabled:not-data-pressed:before:shadow-[0_-1px_--theme(--color-white/2%)] [:disabled,:active,[data-pressed]]:shadow-none",
      },
    },
  },
);

export function Toggle({
  className,
  variant,
  size,
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>): React.ReactElement {
  return (
    <TogglePrimitive
      className={cn(toggleVariants({ className, size, variant }))}
      data-slot="toggle"
      {...props}
    />
  );
}

export { TogglePrimitive };
