"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import * as React from "react";
import {
  type SegmentedControlSize,
  segmentedControlItemLayoutClassName,
  segmentedControlItemSizeClassNames,
} from "./lib/segmented-control";
import { cn } from "./lib/utils";

export type TabsVariant = "default" | "underline" | "pill";
export type TabsSize = SegmentedControlSize;

interface TabsListContextValue {
  size: TabsSize;
  variant: TabsVariant;
}

const TabsListContext = React.createContext<TabsListContextValue>({
  size: "default",
  variant: "default",
});

export function Tabs({ className, ...props }: TabsPrimitive.Root.Props): React.ReactElement {
  return (
    <TabsPrimitive.Root
      className={cn("flex flex-col gap-2 data-[orientation=vertical]:flex-row", className)}
      data-slot="tabs"
      {...props}
    />
  );
}

export function TabsList({
  variant = "default",
  size = "default",
  className,
  children,
  ...props
}: TabsPrimitive.List.Props & {
  size?: TabsSize;
  variant?: TabsVariant;
}): React.ReactElement {
  return (
    <TabsListContext.Provider value={{ size, variant }}>
      <TabsPrimitive.List
        className={cn(
          "relative z-0 flex w-fit items-center justify-center text-muted-foreground",
          "data-[orientation=vertical]:flex-col",
          variant === "pill"
            ? "inline-flex gap-0 rounded-full bg-muted p-1"
            : variant === "default"
              ? "gap-x-0.5 rounded-lg bg-muted p-0.5 text-muted-foreground/72"
              : "data-[orientation=vertical]:px-1 data-[orientation=horizontal]:py-1 *:data-[slot=tabs-tab]:hover:bg-accent",
          className,
        )}
        data-size={size}
        data-slot="tabs-list"
        {...props}
      >
        {children}
        <TabsPrimitive.Indicator
          className={cn(
            "absolute bottom-0 left-0 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) -translate-y-(--active-tab-bottom) transition-[width,translate] duration-200 ease-in-out",
            variant === "underline"
              ? "z-10 bg-primary data-[orientation=horizontal]:h-0.5 data-[orientation=vertical]:w-0.5 data-[orientation=vertical]:-translate-x-px data-[orientation=horizontal]:translate-y-px"
              : variant === "pill"
                ? "-z-1 rounded-full bg-background shadow-sm/8"
                : "-z-1 rounded-md bg-background shadow-sm/5 dark:bg-input",
          )}
          data-slot="tab-indicator"
        />
      </TabsPrimitive.List>
    </TabsListContext.Provider>
  );
}

export function TabsTab({
  className,
  size,
  ...props
}: TabsPrimitive.Tab.Props & {
  size?: TabsSize;
}): React.ReactElement {
  const context = React.useContext(TabsListContext);
  const resolvedSize = size ?? context.size;
  const variant = context.variant;

  return (
    <TabsPrimitive.Tab
      className={cn(
        "relative flex cursor-pointer items-center justify-center whitespace-nowrap font-medium outline-none transition-[color,background-color,box-shadow] data-disabled:pointer-events-none data-disabled:opacity-64",
        variant === "pill"
          ? "z-[1] h-9 select-none rounded-full px-4 text-base text-muted-foreground hover:text-foreground/70 data-active:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
          : cn(
              "shrink-0 grow rounded-md border border-transparent text-base hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring data-[orientation=vertical]:w-full data-[orientation=vertical]:justify-start data-active:text-foreground sm:text-sm",
              segmentedControlItemLayoutClassName,
              segmentedControlItemSizeClassNames[resolvedSize],
            ),
        className,
      )}
      data-size={resolvedSize}
      data-slot="tabs-tab"
      {...props}
    />
  );
}

export function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props): React.ReactElement {
  return (
    <TabsPrimitive.Panel
      className={cn("flex-1 outline-none", className)}
      data-slot="tabs-content"
      {...props}
    />
  );
}

export { TabsPrimitive, TabsTab as TabsTrigger, TabsPanel as TabsContent };
