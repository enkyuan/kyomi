/* oxlint-disable react-doctor/only-export-components */
"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { useSquircle } from "../lib/squircle";
import { cn } from "../lib/utils";

/** Outer radius of every item; media and targets inside it use radius − padding. */
const ITEM_RADIUS_PX = 16;

export const itemVariants = cva(
  "group/item relative flex w-full min-w-0 items-center gap-(--item-gap) p-(--item-padding) text-left text-base outline-none transition-colors [--item-padding:--spacing(2)] [--item-radius:16px] hover:bg-accent/70 data-selected:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
  {
    defaultVariants: {
      shape: "rounded",
      size: "default",
    },
    variants: {
      shape: {
        rounded: "rounded-(--item-radius)",
        /** Continuous corners drawn with a measured clip path. */
        squircle: "",
      },
      size: {
        /** Compact rail rows: 14px titles over 12px meta. */
        sm: "[--item-gap:--spacing(2.5)]",
        /** Full-width list rows: 16px titles over 14px meta. */
        default: "[--item-gap:--spacing(3)]",
      },
    },
  },
);

export interface ItemProps extends useRender.ComponentProps<"div"> {
  size?: VariantProps<typeof itemVariants>["size"];
  shape?: VariantProps<typeof itemVariants>["shape"];
  /** Persistent selected state, e.g. while bulk-selecting. */
  selected?: boolean;
}

function itemProps({ className, size, shape, selected }: ItemProps) {
  return {
    className: cn(itemVariants({ shape, size }), className),
    "data-selected": selected ? "" : undefined,
    "data-item-size": size ?? "default",
    "data-slot": "item",
  };
}

function SquircleItem({
  className,
  size,
  selected,
  render,
  ...props
}: ItemProps): React.ReactElement {
  const squircle = useSquircle<HTMLElement>(ITEM_RADIUS_PX, 1);
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { ...itemProps({ className, selected, shape: "squircle", size }), style: squircle.style },
      props,
    ),
    ref: squircle.ref,
    render,
  });
}

function RoundedItem({
  className,
  size,
  selected,
  render,
  ...props
}: ItemProps): React.ReactElement {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(itemProps({ className, selected, shape: "rounded", size }), props),
    render,
  });
}

/**
 * A row in a list: optional media, a title and description, and trailing actions. Put the row's
 * main link or button in `ItemTarget` so the whole row is clickable while actions stay separate.
 */
export function Item({ shape = "rounded", ...props }: ItemProps): React.ReactElement {
  return shape === "squircle" ? <SquircleItem {...props} /> : <RoundedItem {...props} />;
}

/**
 * The row's primary link or button. Its hit area stretches over the whole item; its focus ring
 * sits inside the row with a concentric radius, so squircle clipping never cuts it off.
 */
export function ItemTarget({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">): React.ReactElement {
  const defaultProps = {
    className: cn(
      "flex min-w-0 flex-1 cursor-pointer items-center gap-(--item-gap) rounded-[calc(var(--item-radius)-var(--item-padding))] text-left outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
      className,
    ),
    "data-slot": "item-target",
  };
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  });
}

export function ItemMedia({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[calc(var(--item-radius)-var(--item-padding))] [&_svg]:pointer-events-none",
        className,
      )}
      data-slot="item-media"
      {...props}
    />
  );
}

export function ItemContent({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return <div className={cn("min-w-0 flex-1", className)} data-slot="item-content" {...props} />;
}

export function ItemTitle({
  className,
  ...props
}: React.ComponentProps<"span">): React.ReactElement {
  return (
    <span
      className={cn(
        "block truncate font-semibold text-base leading-5 in-data-[item-size=sm]:text-sm",
        className,
      )}
      data-slot="item-title"
      {...props}
    />
  );
}

export function ItemDescription({
  className,
  ...props
}: React.ComponentProps<"span">): React.ReactElement {
  return (
    <span
      className={cn(
        "block truncate text-muted-foreground text-sm in-data-[item-size=sm]:text-xs in-data-[item-size=sm]:leading-4",
        className,
      )}
      data-slot="item-description"
      {...props}
    />
  );
}

export interface ItemActionsProps extends React.ComponentProps<"div"> {
  /** Dim the actions until the row is hovered or focused. */
  reveal?: boolean;
}

export function ItemActions({
  className,
  reveal = false,
  ...props
}: ItemActionsProps): React.ReactElement {
  return (
    <div
      className={cn(
        "relative z-1 flex shrink-0 items-center gap-0.5",
        reveal &&
          "opacity-70 transition-opacity group-focus-within/item:opacity-100 group-hover/item:opacity-100",
        className,
      )}
      data-slot="item-actions"
      {...props}
    />
  );
}
