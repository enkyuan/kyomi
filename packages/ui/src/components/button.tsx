/* oxlint-disable react-doctor/only-export-components */
"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../lib/utils";
import { GroupSeparator, GroupText, groupVariants } from "./group";
import { Spinner } from "./spinner";
import { TextMorph } from "./text-morph";

export const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-medium text-base outline-none transition-[box-shadow,scale] duration-(--duration-control) ease-out-quint before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-var(--stroke-width))] pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-(--touch-target-min) pointer-coarse:after:min-w-(--touch-target-min) focus-visible:ring-(length:--focus-ring-width) focus-visible:ring-ring focus-visible:ring-offset-(length:--focus-ring-offset) focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-(--opacity-disabled) data-loading:select-none data-loading:text-transparent sm:text-sm [&_svg:not([class*='opacity-'])]:opacity-(--opacity-icon) [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg:not([class*='mx-'])]:-mx-0.5 [&_svg]:shrink-0 [&_svg]:[stroke-width:var(--icon-stroke)]",
  {
    defaultVariants: {
      press: true,
      shape: "default",
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-(--control-md) px-[calc(--spacing(3)-var(--stroke-width))] sm:h-(--control-sm)",
        icon: "size-(--control-md) sm:size-(--control-sm)",
        "icon-lg": "size-(--control-lg) sm:size-(--control-md)",
        "icon-sm": "size-(--control-sm) sm:size-(--control-xs)",
        "icon-xl":
          "size-(--control-xl) sm:size-(--control-lg) [&_svg:not([class*='size-'])]:size-5 sm:[&_svg:not([class*='size-'])]:size-4.5",
        "icon-xs":
          "size-(--control-xs) rounded-md before:rounded-[calc(var(--radius-md)-var(--stroke-width))] sm:size-(--control-2xs) not-in-data-[slot=input-group]:[&_svg:not([class*='size-'])]:size-4 sm:not-in-data-[slot=input-group]:[&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-(--control-lg) px-[calc(--spacing(3.5)-var(--stroke-width))] sm:h-(--control-md)",
        sm: "h-(--control-sm) gap-1.5 px-[calc(--spacing(2.5)-var(--stroke-width))] sm:h-(--control-xs)",
        xl: "h-(--control-xl) px-[calc(--spacing(4)-var(--stroke-width))] text-lg sm:h-(--control-lg) sm:text-base [&_svg:not([class*='size-'])]:size-5 sm:[&_svg:not([class*='size-'])]:size-4.5",
        xs: "h-(--control-xs) gap-1 rounded-md px-[calc(--spacing(2)-var(--stroke-width))] text-sm before:rounded-[calc(var(--radius-md)-var(--stroke-width))] sm:h-(--control-2xs) sm:text-xs [&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3.5",
      },
      shape: {
        default: "",
        /** Capsule ends; the inner highlight follows so the corners stay concentric. */
        pill: "rounded-full before:rounded-full",
      },
      press: {
        /** Tactile press feedback, skipped when the user prefers reduced motion. */
        true: "motion-safe:active:scale-(--press-scale)",
        false: "",
      },
      variant: {
        default:
          "not-disabled:inset-shadow-[0_1px_--theme(--color-white/16%)] border-primary bg-primary text-primary-foreground shadow-primary/24 shadow-xs hover:bg-primary/90 data-pressed:bg-primary/90 *:data-[slot=button-loading-indicator]:text-primary-foreground [:active,[data-pressed]]:inset-shadow-[0_1px_--theme(--color-black/8%)] [:disabled,:active,[data-pressed]]:shadow-none",
        destructive:
          "not-disabled:inset-shadow-[0_1px_--theme(--color-white/16%)] border-destructive bg-destructive text-white shadow-destructive/24 shadow-xs hover:bg-destructive/90 data-pressed:bg-destructive/90 *:data-[slot=button-loading-indicator]:text-white [:active,[data-pressed]]:inset-shadow-[0_1px_--theme(--color-black/8%)] [:disabled,:active,[data-pressed]]:shadow-none",
        "destructive-outline":
          "border-input bg-popover not-dark:bg-clip-padding text-destructive-foreground shadow-xs/5 not-disabled:not-active:not-data-pressed:before:shadow-(--shadow-edge-raised) hover:border-destructive/32 hover:bg-destructive/4 data-pressed:border-destructive/32 data-pressed:bg-destructive/4 *:data-[slot=button-loading-indicator]:text-foreground dark:bg-input/32 dark:not-disabled:before:shadow-[0_-1px_--theme(--color-white/2%)] dark:not-disabled:not-active:not-data-pressed:before:shadow-(--shadow-edge-highlight) [:disabled,:active,[data-pressed]]:shadow-none",
        ghost:
          "border-transparent text-foreground hover:bg-accent data-pressed:bg-accent *:data-[slot=button-loading-indicator]:text-foreground",
        /** Quiet icon actions in toolbars: muted until hovered, pressed, or active. */
        "ghost-muted":
          "border-transparent text-muted-foreground transition-[box-shadow,scale,color,background-color] hover:bg-accent hover:text-foreground data-pressed:bg-accent data-pressed:text-foreground *:data-[slot=button-loading-indicator]:text-foreground",
        link: "border-transparent text-foreground underline-offset-4 hover:underline data-pressed:underline *:data-[slot=button-loading-indicator]:text-foreground",
        outline:
          "border-input bg-popover not-dark:bg-clip-padding text-foreground shadow-xs/5 not-disabled:not-active:not-data-pressed:before:shadow-(--shadow-edge-raised) hover:bg-accent/50 data-pressed:bg-accent/50 *:data-[slot=button-loading-indicator]:text-foreground dark:bg-input/32 dark:data-pressed:bg-input/64 dark:hover:bg-input/64 dark:not-disabled:before:shadow-[0_-1px_--theme(--color-white/2%)] dark:not-disabled:not-active:not-data-pressed:before:shadow-(--shadow-edge-highlight) [:disabled,:active,[data-pressed]]:shadow-none",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/90 data-pressed:bg-secondary/90 *:data-[slot=button-loading-indicator]:text-secondary-foreground [:active,[data-pressed]]:bg-secondary/80",
        /** Tinted primary for secondary actions that still need the brand colour. */
        soft: "border-transparent bg-primary/14 text-primary transition-[box-shadow,scale,color,background-color] hover:bg-primary/20 data-pressed:bg-primary/20 *:data-[slot=button-loading-indicator]:text-primary",
      },
    },
  },
);

export interface ButtonProps extends useRender.ComponentProps<"button"> {
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  shape?: VariantProps<typeof buttonVariants>["shape"];
  /** Skip the press scale, for controls where motion would distract. */
  static?: boolean;
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  shape,
  static: isStatic = false,
  render,
  children,
  loading = false,
  disabled: disabledProp,
  ...props
}: ButtonProps): React.ReactElement {
  const isDisabled: boolean = Boolean(loading || disabledProp);
  const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>["type"] = render
    ? undefined
    : "button";

  const defaultProps = {
    children: (
      <>
        {children}
        {loading && (
          <Spinner className="pointer-events-none absolute" data-slot="button-loading-indicator" />
        )}
      </>
    ),
    className: cn(
      buttonVariants({ className, press: !isStatic && variant !== "link", shape, size, variant }),
    ),
    "aria-disabled": loading || undefined,
    "data-loading": loading ? "" : undefined,
    "data-slot": "button",
    disabled: isDisabled,
    type: typeValue,
  };

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(defaultProps, props),
    render,
  });
}

export const buttonGroupVariants = cva("", {
  defaultVariants: {
    orientation: "horizontal",
    variant: "attached",
  },
  variants: {
    orientation: {
      horizontal: "",
      vertical: "",
    },
    variant: {
      /** Joined segments sharing borders (the shared `Group`). */
      attached: "",
      /** Separate pill segments: capsule outer ends, small inner corners, a hairline gap. */
      split:
        "inline-flex w-fit gap-(--split-gap) [--split-gap:calc(var(--split-h,var(--control-md))/24)] [--split-inner:calc(var(--split-h,var(--control-md))/8)] *:pointer-coarse:after:min-h-auto *:pointer-coarse:after:min-w-auto *:data-[slot=button]:before:rounded-[inherit]",
    },
  },
  compoundVariants: [
    {
      variant: "attached",
      orientation: "horizontal",
      className: groupVariants({ orientation: "horizontal" }),
    },
    {
      variant: "attached",
      orientation: "vertical",
      className: groupVariants({ orientation: "vertical" }),
    },
    {
      variant: "split",
      orientation: "horizontal",
      className:
        "flex-row *:data-[slot=button]:rounded-sm *:data-[slot=button]:first:rounded-s-full *:data-[slot=button]:last:rounded-e-full",
    },
    {
      variant: "split",
      orientation: "vertical",
      className:
        "flex-col *:data-[slot=button]:rounded-sm *:data-[slot=button]:first:rounded-t-xl *:data-[slot=button]:last:rounded-b-xl",
    },
  ],
});

export interface ButtonGroupProps extends useRender.ComponentProps<"div"> {
  variant?: VariantProps<typeof buttonGroupVariants>["variant"];
  orientation?: VariantProps<typeof buttonGroupVariants>["orientation"];
}

/**
 * Groups related buttons. `attached` joins them into one bordered control; `split` keeps each a
 * separate pill with concentric inner corners, like a theme and language switcher. For arrow-key
 * roving, render it as a Base UI toolbar: `render={<ToolbarPrimitive.Root />}` with
 * `ToolbarButton` children.
 */
export function ButtonGroup({
  className,
  variant = "attached",
  orientation = "horizontal",
  render,
  ...props
}: ButtonGroupProps): React.ReactElement {
  const defaultProps = {
    className: cn(buttonGroupVariants({ orientation, variant }), className),
    "data-orientation": orientation,
    "data-slot": "button-group",
    "data-variant": variant,
    role: "group",
  };
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  });
}

export { GroupSeparator as ButtonGroupSeparator, GroupText as ButtonGroupText };

export interface ButtonLabelProps extends Omit<React.ComponentProps<"span">, "children"> {
  children: string | number;
}

/**
 * Button text that morphs in place when it changes, e.g. "Dark" ↔ "Light": shared letters glide and
 * the rest fade. The first render never animates and reduced motion swaps instantly.
 */
export function ButtonLabel({
  children,
  className,
  ...props
}: ButtonLabelProps): React.ReactElement {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden whitespace-nowrap",
        className,
      )}
      data-slot="button-label"
      {...props}
    >
      <TextMorph>{children}</TextMorph>
    </span>
  );
}
