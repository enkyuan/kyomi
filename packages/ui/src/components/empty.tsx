import { cva, type VariantProps } from "class-variance-authority";
import type React from "react";
import { cn } from "../lib/utils";

const emptyMediaVariants = cva(
  "flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "bg-transparent",
        /** Large product illustration, 160px (176px from sm). */
        illustration:
          "bg-transparent [&_svg:not([class*='size-'])]:size-40 sm:[&_svg:not([class*='size-'])]:size-44",
        icon: "relative flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-background text-muted-foreground shadow-xs/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)] [&_svg:not([class*='size-'])]:size-4",
      },
    },
  },
);

export const emptyVariants = cva(
  "flex min-w-0 flex-1 flex-col items-center justify-center text-balance text-center",
  {
    defaultVariants: {
      size: "default",
    },
    variants: {
      size: {
        /** Inside a rail section or card. */
        sm: "min-h-0 gap-3 px-2 py-6",
        /** Fills a panel, such as an empty list or reader. */
        md: "min-h-72 gap-5 px-6 py-10",
        default: "gap-6 px-6 py-12 md:py-20",
        /** Takes over the viewport, such as error and not-found pages. */
        page: "min-h-svh gap-5 px-6 py-10",
      },
    },
  },
);

export function Empty({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyVariants>): React.ReactElement {
  return (
    <div
      className={cn(emptyVariants({ size }), className)}
      data-empty-size={size}
      data-slot="empty"
      {...props}
    />
  );
}

export function EmptyHeader({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "flex max-w-sm flex-col items-center text-center in-data-[empty-size=sm]:gap-3 in-data-[empty-size=md]:w-full in-data-[empty-size=md]:max-w-136 in-data-[empty-size=page]:max-w-md",
        className,
      )}
      data-slot="empty-header"
      {...props}
    />
  );
}

export function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>): React.ReactElement {
  return (
    <div
      className={cn(
        "relative mb-6 in-data-[empty-size=sm]:mb-0 in-data-[empty-size=md]:mb-5",
        className,
      )}
      data-slot="empty-media"
      data-variant={variant}
      {...props}
    >
      {variant === "icon" && (
        <>
          <div
            aria-hidden="true"
            className={cn(
              emptyMediaVariants({ className, variant }),
              "pointer-events-none absolute bottom-px origin-bottom-left -translate-x-0.5 -rotate-10 scale-84 opacity-75 shadow-none",
            )}
          />
          <div
            aria-hidden="true"
            className={cn(
              emptyMediaVariants({ className, variant }),
              "pointer-events-none absolute bottom-px origin-bottom-right translate-x-0.5 rotate-10 scale-84 opacity-75 shadow-none",
            )}
          />
        </>
      )}
      <div className={cn(emptyMediaVariants({ className, variant }))} {...props} />
    </div>
  );
}

export function EmptyTitle({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "font-heading font-semibold text-xl in-data-[empty-size=sm]:text-sm in-data-[empty-size=md]:text-base in-data-[empty-size=page]:text-2xl",
        className,
      )}
      data-slot="empty-title"
      {...props}
    />
  );
}

export function EmptyDescription({
  className,
  ...props
}: React.ComponentProps<"p">): React.ReactElement {
  return (
    <div
      className={cn(
        "text-muted-foreground text-sm [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4 [[data-slot=empty-title]+&]:mt-1 in-data-[empty-size=md]:mx-auto in-data-[empty-size=md]:max-w-110 in-data-[empty-size=md]:leading-6 in-data-[empty-size=md]:[[data-slot=empty-title]+&]:mt-2",
        className,
      )}
      data-slot="empty-description"
      {...props}
    />
  );
}

export function EmptyContent({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 max-w-sm flex-col items-center gap-4 text-balance text-sm",
        className,
      )}
      data-slot="empty-content"
      {...props}
    />
  );
}
