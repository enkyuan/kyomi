import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import type React from "react";
import { cn } from "../lib/utils";

export function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorPrimitive.Props): React.ReactElement {
  const classes = (override?: string) =>
    cn(
      "shrink-0 bg-border data-[orientation=horizontal]:h-(--stroke-width) data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-(--stroke-width) data-[orientation=vertical]:not-[[class^='h-']]:not-[[class*='_h-']]:self-stretch",
      override,
    );

  return (
    <SeparatorPrimitive
      className={
        typeof className === "function" ? (state) => classes(className(state)) : classes(className)
      }
      data-slot="separator"
      orientation={orientation}
      {...props}
    />
  );
}

export { SeparatorPrimitive };
