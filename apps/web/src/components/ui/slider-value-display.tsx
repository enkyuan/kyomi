"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { m, useTransform, type MotionValue } from "motion/react";
import { cn } from "@lib/utils";
import { fontWeights, springs, THUMB_SIZE } from "./slider-shared";

interface ValueDisplayProps {
  values: number[];
  editingIndex: number | null;
  onStartEdit: (index: number) => void;
  onCommitEdit: (index: number, v: number) => void;
  onCancelEdit: () => void;
  min: number;
  max: number;
  step: number;
  formatValue: (v: number) => string;
  label?: string;
  isRange: boolean;
  isInteracting: boolean;
}

interface EditableSliderValueProps {
  index: number;
  value: number;
  editingIndex: number | null;
  inputValue: string;
  inputRef: RefObject<HTMLInputElement | null>;
  min: number;
  max: number;
  step: number;
  formatValue: (v: number) => string;
  label?: string;
  isRange: boolean;
  onInputChange: (value: string) => void;
  onStartEdit: (index: number) => void;
  onCommitEdit: (index: number) => void;
  onCancelEdit: () => void;
}

function EditableSliderValue({
  index,
  value,
  editingIndex,
  inputValue,
  inputRef,
  min,
  max,
  step,
  formatValue,
  label,
  isRange,
  onInputChange,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
}: EditableSliderValueProps) {
  if (editingIndex === index) {
    return (
      <span className="inline-grid text-[13px]">
        {/* Ghost for layout stability — widest possible value */}
        <span
          className="col-start-1 row-start-1 invisible"
          style={{ fontVariationSettings: fontWeights.medium }}
          aria-hidden="true"
        >
          {label ? `${label}: ` : ""}
          {formatValue(max)}
        </span>
        <span className="col-start-1 row-start-1 flex items-center gap-1">
          {label && <span className="text-muted-foreground">{label}:</span>}
          <input
            ref={inputRef}
            type="number"
            value={inputValue}
            min={min}
            max={max}
            step={step}
            onChange={(event) => onInputChange(event.target.value)}
            onBlur={() => onCommitEdit(index)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onCommitEdit(index);
              if (event.key === "Escape") onCancelEdit();
            }}
            aria-label={`Edit slider value${isRange ? (index === 0 ? " (start)" : " (end)") : ""}`}
            className={cn(
              "w-[5ch] rounded-sm border-0 border-b border-input bg-transparent px-0 text-center text-foreground outline-none focus-visible:border-ring",
            )}
            style={{ fontVariationSettings: fontWeights.medium }}
          />
        </span>
      </span>
    );
  }

  return (
    <span
      className="cursor-text select-none"
      role="button"
      tabIndex={0}
      onClick={() => onStartEdit(index)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onStartEdit(index);
        }
      }}
    >
      {formatValue(value)}
    </span>
  );
}

export function ValueDisplay({
  values,
  editingIndex,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  min,
  max,
  step,
  formatValue,
  label,
  isRange,
  isInteracting,
}: ValueDisplayProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingIndex !== null) {
      setInputValue(String(values[editingIndex]));
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editingIndex]);

  const commitEdit = useCallback(
    (index: number) => {
      const parsed = parseFloat(inputValue);
      if (!isNaN(parsed)) {
        const clamped = Math.max(min, Math.min(max, parsed));
        const snapped = Math.round((clamped - min) / step) * step + min;
        onCommitEdit(index, snapped);
      } else {
        onCancelEdit();
      }
    },
    [inputValue, min, max, step, onCommitEdit, onCancelEdit],
  );

  const widestValue = isRange
    ? `${label ? `${label}: ` : ""}${formatValue(max)} — ${formatValue(max)}`
    : `${label ? `${label}: ` : ""}${formatValue(max)}`;

  return (
    <span
      className={cn(
        "inline-grid shrink-0 text-[13px] leading-none text-muted-foreground transition-[font-variation-settings] duration-100",
        "tabular-nums",
      )}
      style={{
        fontVariationSettings: isInteracting ? fontWeights.medium : fontWeights.normal,
      }}
    >
      {/* Invisible ghost — reserves width of widest possible value */}
      <span
        className="col-start-1 row-start-1 invisible whitespace-nowrap"
        style={{ fontVariationSettings: fontWeights.medium }}
        aria-hidden="true"
      >
        {widestValue}
      </span>
      <span className="col-start-1 row-start-1 whitespace-nowrap">
        {label && editingIndex === null && <span className="text-muted-foreground">{label}: </span>}
        {isRange ? (
          <>
            <EditableSliderValue
              index={0}
              value={values[0]}
              editingIndex={editingIndex}
              inputValue={inputValue}
              inputRef={inputRef}
              min={min}
              max={max}
              step={step}
              formatValue={formatValue}
              label={label}
              isRange={isRange}
              onInputChange={setInputValue}
              onStartEdit={onStartEdit}
              onCommitEdit={commitEdit}
              onCancelEdit={onCancelEdit}
            />
            <span className="mx-1 text-muted-foreground/50">to</span>
            <EditableSliderValue
              index={1}
              value={values[1]}
              editingIndex={editingIndex}
              inputValue={inputValue}
              inputRef={inputRef}
              min={min}
              max={max}
              step={step}
              formatValue={formatValue}
              label={label}
              isRange={isRange}
              onInputChange={setInputValue}
              onStartEdit={onStartEdit}
              onCommitEdit={commitEdit}
              onCancelEdit={onCancelEdit}
            />
          </>
        ) : (
          <EditableSliderValue
            index={0}
            value={values[0]}
            editingIndex={editingIndex}
            inputValue={inputValue}
            inputRef={inputRef}
            min={min}
            max={max}
            step={step}
            formatValue={formatValue}
            label={label}
            isRange={isRange}
            onInputChange={setInputValue}
            onStartEdit={onStartEdit}
            onCommitEdit={commitEdit}
            onCancelEdit={onCancelEdit}
          />
        )}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// TooltipValue (internal)
// ---------------------------------------------------------------------------

interface TooltipValueProps {
  value: number;
  formatValue: (v: number) => string;
  motionX: MotionValue<number>;
}

export function TooltipValue({ value, formatValue, motionX }: TooltipValueProps) {
  const tooltipX = useTransform(motionX, (x) => x + THUMB_SIZE / 2);
  return (
    <m.div
      className="absolute -translate-x-1/2 pointer-events-none z-20"
      style={{
        x: tooltipX,
        top: -16,
      }}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4, transition: { duration: 0.1 } }}
      transition={springs.fast}
    >
      <span
        className="whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[12px] text-background tabular-nums"
        style={{ fontVariationSettings: fontWeights.medium }}
      >
        {formatValue(value)}
      </span>
    </m.div>
  );
}
