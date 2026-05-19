import { LoadingFill } from "@mingcute/react";
import type React from "react";
import { cn } from "./lib/utils";

export function Spinner({
  className,
  ...props
}: React.ComponentProps<typeof LoadingFill>): React.ReactElement {
  return (
    <LoadingFill
      aria-label="Loading"
      className={cn("animate-spin", className)}
      role="status"
      {...props}
    />
  );
}
