"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import type React from "react";
import { cn } from "../lib/utils";

export function SegmentedControl({
  className,
  ...props
}: TabsPrimitive.Root.Props): React.ReactElement {
  return (
    <TabsPrimitive.Root
      className={cn("flex", className)}
      data-slot="segmented-control"
      {...props}
    />
  );
}

export function SegmentedControlList({
  className,
  children,
  ...props
}: TabsPrimitive.List.Props): React.ReactElement {
  return (
    <TabsPrimitive.List
      className={cn(
        "relative z-0 inline-flex items-center gap-0 rounded-full bg-muted p-1 text-muted-foreground",
        className,
      )}
      data-slot="segmented-control-list"
      {...props}
    >
      {children}
      <TabsPrimitive.Indicator
        className={cn(
          "-z-1 absolute bottom-0 left-0 h-(--active-tab-height) w-(--active-tab-width)",
          "translate-x-(--active-tab-left) -translate-y-(--active-tab-bottom)",
          "rounded-full bg-background shadow-sm/8",
          "transition-[width,translate] duration-200 ease-in-out",
        )}
        data-slot="segmented-control-indicator"
      />
    </TabsPrimitive.List>
  );
}

export function SegmentedControlTab({
  className,
  ...props
}: TabsPrimitive.Tab.Props): React.ReactElement {
  return (
    <TabsPrimitive.Tab
      className={cn(
        "relative z-[1] flex h-9 cursor-pointer select-none items-center justify-center",
        "whitespace-nowrap rounded-full px-4",
        "font-medium text-base outline-none",
        "text-muted-foreground transition-colors",
        "hover:text-foreground/70",
        "data-active:text-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      data-slot="segmented-control-tab"
      {...props}
    />
  );
}

export function SegmentedControlPanel({
  className,
  ...props
}: TabsPrimitive.Panel.Props): React.ReactElement {
  return (
    <TabsPrimitive.Panel
      className={cn("flex-1 outline-none", className)}
      data-slot="segmented-control-panel"
      {...props}
    />
  );
}
