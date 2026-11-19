"use client";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import type React from "react";
import { cn } from "../lib/utils";
import { ScrollBar } from "./scroll-bar";

export function ScrollArea({
  className,
  children,
  scrollFade = false,
  scrollFadeClassName,
  scrollbarGutter = false,
  scrollbarPlacement = "container",
  ...props
}: ScrollAreaPrimitive.Root.Props & {
  scrollFade?: boolean;
  scrollFadeClassName?: string;
  scrollbarGutter?: boolean;
  /** `viewport` pins the vertical scrollbar to the window edge; see `ScrollBar`. */
  scrollbarPlacement?: "container" | "viewport";
}): React.ReactElement {
  return (
    <ScrollAreaPrimitive.Root className={cn("size-full min-h-0", className)} {...props}>
      <ScrollAreaPrimitive.Viewport
        className={cn(
          "h-full rounded-[inherit] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-has-overflow-y:overscroll-y-contain data-has-overflow-x:overscroll-x-contain",
          scrollFade &&
            (scrollFadeClassName ??
              "data-has-overflow-y:scroll-mask-y-edge-6 data-has-overflow-x:scroll-mask-x-edge-6"),
          scrollbarGutter && "data-has-overflow-y:pe-2.5 data-has-overflow-x:pb-2.5",
        )}
        data-slot="scroll-area-viewport"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar
        className={scrollbarPlacement === "viewport" ? "z-50" : undefined}
        orientation="vertical"
        placement={scrollbarPlacement}
      />
      <ScrollBar orientation="horizontal" />
      <ScrollAreaPrimitive.Corner data-slot="scroll-area-corner" />
    </ScrollAreaPrimitive.Root>
  );
}

export { ScrollAreaPrimitive };
export { ScrollBar } from "./scroll-bar";
