/* oxlint-disable react-doctor/only-export-components */
"use client";

import { Toolbar as ToolbarPrimitive } from "@base-ui/react/toolbar";
import { cva, type VariantProps } from "class-variance-authority";
import type React from "react";
import { cn } from "../lib/utils";

export const toolbarVariants = cva("relative flex", {
  defaultVariants: {
    variant: "default",
  },
  variants: {
    variant: {
      default: "gap-2 rounded-xl border bg-card not-dark:bg-clip-padding p-1 text-card-foreground",
      /** No surface: muted icon actions that sit inside another surface. */
      ghost: "gap-1 text-muted-foreground",
      /** 44px capsule on the opaque muted surface, for chrome over content. */
      pill: "h-11 items-center gap-1 rounded-full bg-muted-solid p-1 text-muted-foreground",
    },
  },
});

export function Toolbar({
  className,
  variant = "default",
  ...props
}: ToolbarPrimitive.Root.Props & VariantProps<typeof toolbarVariants>): React.ReactElement {
  return (
    <ToolbarPrimitive.Root
      className={cn(toolbarVariants({ variant }), className)}
      data-slot="toolbar"
      data-variant={variant}
      {...props}
    />
  );
}

export function ToolbarButton({
  className,
  ...props
}: ToolbarPrimitive.Button.Props): React.ReactElement {
  return (
    <ToolbarPrimitive.Button className={cn(className)} data-slot="toolbar-button" {...props} />
  );
}

export function ToolbarLink({
  className,
  ...props
}: ToolbarPrimitive.Link.Props): React.ReactElement {
  return <ToolbarPrimitive.Link className={cn(className)} data-slot="toolbar-link" {...props} />;
}

export function ToolbarInput({
  className,
  ...props
}: ToolbarPrimitive.Input.Props): React.ReactElement {
  return <ToolbarPrimitive.Input className={cn(className)} data-slot="toolbar-input" {...props} />;
}

export function ToolbarGroup({
  className,
  ...props
}: ToolbarPrimitive.Group.Props): React.ReactElement {
  return (
    <ToolbarPrimitive.Group
      className={cn("flex items-center gap-1", className)}
      data-slot="toolbar-group"
      {...props}
    />
  );
}

export function ToolbarSeparator({
  className,
  inset = false,
  ...props
}: ToolbarPrimitive.Separator.Props & {
  /** A softer divider centred between groups instead of spanning the toolbar. */
  inset?: boolean;
}): React.ReactElement {
  return (
    <ToolbarPrimitive.Separator
      className={cn(
        "shrink-0 bg-border data-[orientation=horizontal]:my-0.5 data-[orientation=vertical]:my-1.5 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:not-[[class^='h-']]:not-[[class*='_h-']]:self-stretch",
        inset && "mx-1 self-center bg-border/70 data-[orientation=vertical]:my-0",
        className,
      )}
      data-slot="toolbar-separator"
      {...props}
    />
  );
}

export { ToolbarPrimitive };
