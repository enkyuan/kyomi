"use client";

import { OTPField as OTPFieldPrimitive } from "@base-ui/react/otp-field";
import type * as React from "react";
import { cn } from "./lib/utils";
import { Separator } from "./separator";

type OTPFieldSize = "default" | "lg";

export type OTPFieldProps = OTPFieldPrimitive.Root.Props & {
  size?: OTPFieldSize;
};

export function OTPField({
  className,
  size = "default",
  ...props
}: OTPFieldProps): React.ReactElement {
  return (
    <OTPFieldPrimitive.Root
      className={cn("flex items-center gap-2 has-disabled:opacity-64", className)}
      data-size={size}
      data-slot="otp-field"
      {...props}
    />
  );
}

export type OTPFieldInputProps = OTPFieldPrimitive.Input.Props;

export function OTPFieldInput({ className, ...props }: OTPFieldInputProps): React.ReactElement {
  return (
    <OTPFieldPrimitive.Input
      className={cn(
        "relative inline-flex in-[[data-slot=otp-field][data-size=lg]]:size-10 size-9 items-center justify-center text-center rounded-lg border border-input bg-background not-dark:bg-clip-padding in-[[data-slot=otp-field][data-size=lg]]:text-lg text-base text-foreground shadow-xs/5 outline-none ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-focus-visible:not-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] aria-invalid:border-destructive/36 focus-visible:z-10 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24 focus-visible:aria-invalid:border-destructive/64 focus-visible:aria-invalid:ring-destructive/16 sm:in-[[data-slot=otp-field][data-size=lg]]:size-9 sm:size-8 sm:in-[[data-slot=otp-field][data-size=lg]]:text-base sm:text-sm dark:bg-input/32 dark:focus-visible:aria-invalid:ring-destructive/24 dark:not-focus-visible:not-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)] [focus-visible,[aria-invalid]]:shadow-none focus-visible:placeholder:text-transparent",
        className,
      )}
      data-slot="otp-field-input"
      {...props}
    />
  );
}

export type OTPFieldSeparatorProps = OTPFieldPrimitive.Separator.Props;

export function OTPFieldSeparator({
  className,
  ...props
}: OTPFieldSeparatorProps): React.ReactElement {
  return (
    <OTPFieldPrimitive.Separator
      data-slot="otp-field-separator"
      render={
        <Separator
          className={cn(
            "rounded-full bg-input data-[orientation=horizontal]:h-0.5 data-[orientation=horizontal]:w-3",
            className,
          )}
        />
      }
      {...props}
    />
  );
}

export { OTPFieldPrimitive };
