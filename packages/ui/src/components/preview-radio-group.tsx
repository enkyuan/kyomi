"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { Field, FieldItem, FieldLabel } from "./field";
import { Radio, RadioGroup } from "./radio-group";

export type PreviewRadioItem<T extends string> = {
  label: string;
  /** A small picture of the option (an 88 by 70 SVG fits the frame). */
  preview: ReactNode;
  value: T;
};

/**
 * A radio group whose options are drawn: each shows a preview in a rounded frame with its label
 * below, and the chosen one gets a ring. Unchosen previews sit back at 80% opacity.
 */
export function PreviewRadioGroup<T extends string>({
  "aria-label": ariaLabel,
  className,
  items,
  onValueChange,
  value,
}: {
  "aria-label"?: string;
  className?: string;
  items: readonly PreviewRadioItem<T>[];
  onValueChange: (value: T) => void;
  value: T;
}) {
  return (
    <Field name={ariaLabel}>
      <RadioGroup
        aria-label={ariaLabel}
        className={cn("flex-row gap-4", className)}
        value={value}
        onValueChange={(next) => {
          const item = items.find((candidate) => candidate.value === next);
          if (item) {
            onValueChange(item.value);
          }
        }}
      >
        {items.map((item) => (
          <FieldItem key={item.value}>
            <FieldLabel className="cursor-pointer flex-col">
              <Radio className="peer absolute sr-only" value={item.value} />
              <span className="relative block h-17.5 w-22 overflow-hidden rounded-lg shadow-xs transition-shadow peer-data-disabled:cursor-not-allowed peer-data-disabled:opacity-(--opacity-disabled) peer-data-checked:ring-(length:--focus-ring-width) peer-data-checked:ring-primary/48 peer-data-checked:ring-offset-(length:--focus-ring-offset) peer-data-checked:ring-offset-background not-peer-data-checked:opacity-80">
                {item.preview}
              </span>
              <span className="text-sm not-peer-data-checked:text-muted-foreground/70">
                {item.label}
              </span>
            </FieldLabel>
          </FieldItem>
        ))}
      </RadioGroup>
    </Field>
  );
}
