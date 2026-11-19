import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import * as stylex from "@stylexjs/stylex";
import type React from "react";
import { cn } from "../lib/utils";

const styles = stylex.create({
  divider: {
    backgroundColor: "var(--border)",
    flexShrink: 0,
  },
});

export function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorPrimitive.Props): React.ReactElement {
  const dividerClassName = stylex.props(styles.divider).className;
  const classes = (override?: string) =>
    cn(
      dividerClassName,
      "data-[orientation=horizontal]:h-(--stroke-width) data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-(--stroke-width) data-[orientation=vertical]:not-[[class^='h-']]:not-[[class*='_h-']]:self-stretch",
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
