"use client";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import type React from "react";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";

const subscribeNever = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

const VIEWPORT_EDGE_STYLE = {
  horizontal: { position: "fixed", insetInline: 0, bottom: 0 },
  vertical: { position: "fixed", top: 0, bottom: 0, insetInlineEnd: 0 },
} as const satisfies Record<"horizontal" | "vertical", React.CSSProperties>;

/**
 * macOS-style overlay scrollbar. Appearance lives in `styles/scrollbar.css`.
 * `placement="viewport"` pins the track to the window edge so every pane sharing a row of columns
 * (list, reader, rail) shows its scrollbar in the same place. The track is portalled to `body`:
 * an animated ancestor (`transform`, `filter`) becomes the containing block of `position: fixed`
 * descendants and would pull the track off the window edge.
 */
export function ScrollBar({
  className,
  orientation = "vertical",
  placement = "container",
  style,
  ...props
}: Omit<ScrollAreaPrimitive.Scrollbar.Props, "style"> & {
  placement?: "container" | "viewport";
  style?: React.CSSProperties;
}): React.ReactElement {
  const canPortal = useSyncExternalStore(subscribeNever, getClientSnapshot, getServerSnapshot);
  const isViewportPlacement = placement === "viewport";
  const scrollbar = (
    <ScrollAreaPrimitive.Scrollbar
      className={cn(
        "hidden data-[orientation=horizontal]:flex-col",
        orientation === "vertical" ? "data-has-overflow-y:flex" : "data-has-overflow-x:flex",
        className,
      )}
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      style={isViewportPlacement ? { ...VIEWPORT_EDGE_STYLE[orientation], ...style } : style}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb className="relative flex-1" data-slot="scroll-area-thumb" />
    </ScrollAreaPrimitive.Scrollbar>
  );

  if (!isViewportPlacement) {
    return scrollbar;
  }

  return canPortal ? createPortal(scrollbar, document.body) : <></>;
}
