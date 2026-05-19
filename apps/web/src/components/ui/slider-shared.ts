import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from "react";

export type SliderValue = number | [number, number];
export type ValuePosition = "left" | "right" | "top" | "bottom" | "tooltip";

export interface SliderProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue"
> {
  ref?: Ref<HTMLDivElement>;
  value: SliderValue;
  onChange: (value: SliderValue) => void;
  min?: number;
  max?: number;
  step?: number;
  showSteps?: boolean;
  showValue?: boolean;
  valuePosition?: ValuePosition;
  formatValue?: (v: number) => string;
  label?: string;
  disabled?: boolean;
  trackClassName?: string;
  trackStyle?: CSSProperties;
  fillClassName?: string;
  fillStyle?: CSSProperties;
  hideFill?: boolean;
  thumbColor?: string;
  thumbBorderColor?: string;
}

export const THUMB_SIZE = 20;
export const THUMB_SIZE_REST = 16;
export const TRACK_BG_HEIGHT = 18;
export const DOT_SIZE = 4;
export const PIP_SIZE = 5;
export const TRACK_INSET = (THUMB_SIZE - TRACK_BG_HEIGHT) / 2;
export const springs = {
  fast: { type: "spring", stiffness: 520, damping: 36, mass: 0.7 } as const,
  moderate: { type: "spring", stiffness: 360, damping: 34, mass: 0.8 } as const,
};
export const fontWeights = {
  normal: '"wght" 400',
  medium: '"wght" 500',
} as const;

export function valueToPixel(v: number, min: number, max: number, trackWidth: number): number {
  if (max === min) return 0;
  const usable = trackWidth - THUMB_SIZE;
  return ((v - min) / (max - min)) * usable;
}

export function pixelToValue(
  px: number,
  min: number,
  max: number,
  step: number,
  trackWidth: number,
): number {
  const usable = trackWidth - THUMB_SIZE;
  if (usable <= 0) return min;
  const raw = (px / usable) * (max - min) + min;
  const snapped = Math.round((raw - min) / step) * step + min;
  return Math.max(min, Math.min(max, snapped));
}

export function toRadixValue(value: SliderValue): number[] {
  return Array.isArray(value) ? value : [value];
}

export interface SliderComfortableProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  | "onChange"
  | "defaultValue"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onDragOver"
  | "onAnimationStart"
> {
  ref?: Ref<HTMLDivElement>;
  value: number;
  onChange: (value: number) => void;
  /** Invoked when a pointer drag ends (or resize handle) with the final value; also runs for keyboard changes via the hidden Radix control. */
  onValueCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  variant?: "pips" | "scrubber";
  label?: ReactNode;
  formatValue?: (v: number) => string;
  disabled?: boolean;
}
