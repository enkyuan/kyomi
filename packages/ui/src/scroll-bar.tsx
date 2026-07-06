"use client";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import type React from "react";
import { cn } from "./lib/utils";

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props): React.ReactElement {
  return (
    <ScrollAreaPrimitive.Scrollbar
      className={cn(
        "m-0.5 hidden data-[orientation=horizontal]:flex-col",
        orientation === "vertical" ? "data-has-overflow-y:flex" : "data-has-overflow-x:flex",
        className,
      )}
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        className="relative flex-1 rounded-full bg-(--scrollbar-thumb)"
        data-slot="scroll-area-thumb"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export function BrowserScrollBar(
  props: ScrollAreaPrimitive.Scrollbar.Props,
): React.ReactElement | null {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useBrowserLayoutEffect(() => {
    setContainer(document.body);
  }, []);

  if (!container) {
    return null;
  }

  return createPortal(<ScrollBar {...props} />, container);
}
