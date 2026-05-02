"use client";

import type { ReaderMode } from "@lib/reader-mode";
import { cn } from "@lib/utils";

type ReaderModeToggleProps = {
  mode: ReaderMode;
  onChange: (mode: ReaderMode) => void;
  extractedAvailable: boolean;
  className?: string;
};

export function ReaderModeToggle({
  mode,
  onChange,
  extractedAvailable,
  className,
}: ReaderModeToggleProps) {
  return (
    <div
      className={cn(
        "not-prose inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs font-medium",
        className,
      )}
      role="group"
      aria-label="Reader content source"
    >
      <button
        type="button"
        className={cn(
          "rounded-md px-2.5 py-1 transition-colors",
          mode === "original"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => onChange("original")}
      >
        Original
      </button>
      <button
        type="button"
        disabled={!extractedAvailable}
        className={cn(
          "rounded-md px-2.5 py-1 transition-colors",
          !extractedAvailable && "cursor-not-allowed opacity-50",
          mode === "extracted"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => extractedAvailable && onChange("extracted")}
      >
        Extracted
      </button>
    </div>
  );
}
