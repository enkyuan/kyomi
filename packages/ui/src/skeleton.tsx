import type React from "react";
import { cn } from "./lib/utils";

/** Shared shimmer surface for `<Skeleton />` and imperative DOM (e.g. reader image placeholders). */
export const skeletonShimmerClassName =
  "animate-skeleton rounded-sm [--skeleton-highlight:--alpha(var(--color-white)/64%)] [background:linear-gradient(120deg,transparent_40%,var(--skeleton-highlight),transparent_60%)_var(--color-muted)_0_0/200%_100%_fixed] dark:[--skeleton-highlight:--alpha(var(--color-white)/4%)]";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div className={cn(skeletonShimmerClassName, className)} data-slot="skeleton" {...props} />
  );
}
