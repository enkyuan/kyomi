/* oxlint-disable react-doctor/only-export-components */
"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";
import { GroupSeparator, GroupText, groupVariants } from "./group";
import { Spinner } from "./spinner";

export const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-medium text-base outline-none transition-[box-shadow,scale] duration-150 ease-out-quint before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-64 data-loading:select-none data-loading:text-transparent sm:text-sm [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg:not([class*='mx-'])]:-mx-0.5 [&_svg]:shrink-0",
  {
    defaultVariants: {
      press: true,
      shape: "default",
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-9 px-[calc(--spacing(3)-1px)] sm:h-8",
        icon: "size-9 sm:size-8",
        "icon-lg": "size-10 sm:size-9",
        "icon-sm": "size-8 sm:size-7",
        "icon-xl":
          "size-11 sm:size-10 [&_svg:not([class*='size-'])]:size-5 sm:[&_svg:not([class*='size-'])]:size-4.5",
        "icon-xs":
          "size-7 rounded-md before:rounded-[calc(var(--radius-md)-1px)] sm:size-6 not-in-data-[slot=input-group]:[&_svg:not([class*='size-'])]:size-4 sm:not-in-data-[slot=input-group]:[&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 px-[calc(--spacing(3.5)-1px)] sm:h-9",
        sm: "h-8 gap-1.5 px-[calc(--spacing(2.5)-1px)] sm:h-7",
        xl: "h-11 px-[calc(--spacing(4)-1px)] text-lg sm:h-10 sm:text-base [&_svg:not([class*='size-'])]:size-5 sm:[&_svg:not([class*='size-'])]:size-4.5",
        xs: "h-7 gap-1 rounded-md px-[calc(--spacing(2)-1px)] text-sm before:rounded-[calc(var(--radius-md)-1px)] sm:h-6 sm:text-xs [&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3.5",
      },
      shape: {
        default: "",
        /** Capsule ends; the inner highlight follows so the corners stay concentric. */
        pill: "rounded-full before:rounded-full",
      },
      press: {
        /** Tactile press feedback, skipped when the user prefers reduced motion. */
        true: "motion-safe:active:scale-96",
        false: "",
      },
      variant: {
        default:
          "not-disabled:inset-shadow-[0_1px_--theme(--color-white/16%)] border-primary bg-primary text-primary-foreground shadow-primary/24 shadow-xs hover:bg-primary/90 data-pressed:bg-primary/90 *:data-[slot=button-loading-indicator]:text-primary-foreground [:active,[data-pressed]]:inset-shadow-[0_1px_--theme(--color-black/8%)] [:disabled,:active,[data-pressed]]:shadow-none",
        destructive:
          "not-disabled:inset-shadow-[0_1px_--theme(--color-white/16%)] border-destructive bg-destructive text-white shadow-destructive/24 shadow-xs hover:bg-destructive/90 data-pressed:bg-destructive/90 *:data-[slot=button-loading-indicator]:text-white [:active,[data-pressed]]:inset-shadow-[0_1px_--theme(--color-black/8%)] [:disabled,:active,[data-pressed]]:shadow-none",
        "destructive-outline":
          "border-input bg-popover not-dark:bg-clip-padding text-destructive-foreground shadow-xs/5 not-disabled:not-active:not-data-pressed:before:shadow-[0_1px_--theme(--color-black/4%)] hover:border-destructive/32 hover:bg-destructive/4 data-pressed:border-destructive/32 data-pressed:bg-destructive/4 *:data-[slot=button-loading-indicator]:text-foreground dark:bg-input/32 dark:not-disabled:before:shadow-[0_-1px_--theme(--color-white/2%)] dark:not-disabled:not-active:not-data-pressed:before:shadow-[0_-1px_--theme(--color-white/6%)] [:disabled,:active,[data-pressed]]:shadow-none",
        ghost:
          "border-transparent text-foreground hover:bg-accent data-pressed:bg-accent *:data-[slot=button-loading-indicator]:text-foreground",
        /** Quiet icon actions in toolbars: muted until hovered, pressed, or active. */
        "ghost-muted":
          "border-transparent text-muted-foreground transition-[box-shadow,scale,color,background-color] hover:bg-accent hover:text-foreground data-pressed:bg-accent data-pressed:text-foreground *:data-[slot=button-loading-indicator]:text-foreground",
        link: "border-transparent text-foreground underline-offset-4 hover:underline data-pressed:underline *:data-[slot=button-loading-indicator]:text-foreground",
        outline:
          "border-input bg-popover not-dark:bg-clip-padding text-foreground shadow-xs/5 not-disabled:not-active:not-data-pressed:before:shadow-[0_1px_--theme(--color-black/4%)] hover:bg-accent/50 data-pressed:bg-accent/50 *:data-[slot=button-loading-indicator]:text-foreground dark:bg-input/32 dark:data-pressed:bg-input/64 dark:hover:bg-input/64 dark:not-disabled:before:shadow-[0_-1px_--theme(--color-white/2%)] dark:not-disabled:not-active:not-data-pressed:before:shadow-[0_-1px_--theme(--color-white/6%)] [:disabled,:active,[data-pressed]]:shadow-none",
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
      /** Joined segments sharing borders (the coss `Group`). */
      attached: "",
      /** Separate pill segments: capsule outer ends, small inner corners, a hairline gap. */
      split:
        "inline-flex w-fit gap-0.75 *:pointer-coarse:after:min-h-auto *:pointer-coarse:after:min-w-auto *:data-[slot=button]:before:rounded-[inherit]",
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

const LABEL_EASING = "cubic-bezier(0.23, 1, 0.32, 1)";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export interface ButtonLabelProps extends React.ComponentProps<"span"> {
  /** Identity of the label. Defaults to the text content when `children` is a string or number. */
  labelKey?: string | number;
}

/**
 * Button text that crossfades through a light blur and morphs the button's width when it changes,
 * e.g. "Dark" ↔ "Light". The first render never animates; reduced motion swaps instantly.
 */
export function ButtonLabel({
  children,
  labelKey,
  className,
  ...props
}: ButtonLabelProps): React.ReactElement {
  const key =
    labelKey ??
    (typeof children === "string" || typeof children === "number" ? children : undefined);
  const rootRef = useRef<HTMLSpanElement>(null);
  const width = useRef(0);
  const previous = useRef<{ key: typeof key; node: React.ReactNode }>({ key, node: children });
  const [exiting, setExiting] = useState<{ id: number; node: React.ReactNode } | null>(null);
  const [generation, setGeneration] = useState(0);
  const exitCount = useRef(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) width.current = entry.borderBoxSize[0]?.inlineSize ?? entry.contentRect.width;
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const last = previous.current;
    if (key === undefined || last.key === key) {
      previous.current = { key, node: children };
      return;
    }
    previous.current = { key, node: children };
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;
    setGeneration((current) => current + 1);
    exitCount.current += 1;
    setExiting({ id: exitCount.current, node: last.node });
    const from = width.current;
    const to = root.getBoundingClientRect().width;
    if (from > 0 && Math.abs(from - to) > 0.5) {
      root.animate([{ width: `${from}px` }, { width: `${to}px` }], {
        duration: 200,
        easing: LABEL_EASING,
      });
    }
  }, [key, children]);

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden whitespace-nowrap",
        className,
      )}
      data-slot="button-label"
      ref={rootRef}
      {...props}
    >
      <span
        className={cn(
          generation > 0 &&
            "transition-[opacity,filter] duration-200 ease-out-quint starting:opacity-0 starting:blur-[2px]",
        )}
        key={generation}
      >
        {children}
      </span>
      {exiting ? (
        <ButtonLabelExit
          key={exiting.id}
          onDone={() => setExiting((current) => (current?.id === exiting.id ? null : current))}
        >
          {exiting.node}
        </ButtonLabelExit>
      ) : null}
    </span>
  );
}

function ButtonLabelExit({
  children,
  onDone,
}: {
  children: React.ReactNode;
  onDone: () => void;
}): React.ReactElement {
  const ref = useRef<HTMLSpanElement>(null);
  const done = useRef(onDone);
  useLayoutEffect(() => {
    done.current = onDone;
  });
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const fade = node.animate(
      [
        { opacity: 1, filter: "blur(0px)" },
        { opacity: 0, filter: "blur(2px)" },
      ],
      { duration: 150, easing: LABEL_EASING, fill: "forwards" },
    );
    fade.finished.then(
      () => done.current(),
      () => {},
    );
    return () => fade.cancel();
  }, []);
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      ref={ref}
    >
      {children}
    </span>
  );
}
