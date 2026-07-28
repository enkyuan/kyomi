"use client";

import type { CSSProperties, PointerEvent, RefObject } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { AnimatePresence, m, type MotionValue } from "motion/react";
import { cn } from "../../../lib/utils";
import { TooltipValue } from "./value-display";
import { VisualThumb } from "./visual-thumb";
import {
  DOT_SIZE,
  fontWeights,
  springs,
  THUMB_SIZE,
  TRACK_BG_HEIGHT,
  TRACK_INSET,
  type ValuePosition,
} from "../lib/model";
import type { PrimarySliderUiAction, PrimarySliderUiState } from "../lib/primary-state";

export type PrimaryTrackProps = {
  valuePosition: ValuePosition;
  showValue: boolean;
  formatValue: (v: number) => string;
  label?: string;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  trackClassName?: string;
  trackStyle?: CSSProperties;
  fillClassName?: string;
  fillStyle?: CSSProperties;
  hideFill?: boolean;
  thumbColor?: string;
  thumbBorderColor?: string;
  isRange: boolean;
  values: number[];
  trackRef: RefObject<HTMLDivElement | null>;
  dragging: RefObject<boolean>;
  ui: PrimarySliderUiState;
  dispatchUi: React.ActionDispatch<[action: PrimarySliderUiAction]>;
  motionX0: MotionValue<number>;
  motionX1: MotionValue<number>;
  fillLeft: MotionValue<number>;
  fillWidth: MotionValue<number>;
  stepDotsMask: MotionValue<string>;
  computeHoverPreview: (cursorX: number, trackWidth: number) => void;
  handlePointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  handlePointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  handlePointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  handleRadixChange: (newValues: number[]) => void;
  stepDots: Array<{ value: number; percent: number }>;
  isInteracting: boolean;
};

// oxlint-disable-next-line eslint/complexity,react-doctor/no-many-boolean-props
export function PrimaryTrack({
  valuePosition,
  showValue,
  formatValue,
  label,
  min,
  max,
  step,
  disabled,
  trackClassName,
  trackStyle,
  fillClassName,
  fillStyle,
  hideFill,
  thumbColor,
  thumbBorderColor,
  isRange,
  values,
  trackRef,
  dragging,
  ui,
  dispatchUi,
  motionX0,
  motionX1,
  fillLeft,
  fillWidth,
  stepDotsMask,
  computeHoverPreview,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handleRadixChange,
  stepDots,
  isInteracting,
}: PrimaryTrackProps) {
  const { isHovered, isPressed, hoverPreview, focusedThumb, showHoverTooltip, ready } = ui;

  return (
    <div
      className="relative flex-1 overflow-visible"
      style={{
        height:
          valuePosition === "left" || valuePosition === "right"
            ? THUMB_SIZE + 16
            : THUMB_SIZE + (valuePosition === "tooltip" ? 16 : 0),
        paddingTop: valuePosition === "tooltip" ? 16 : 0,
      }}
      onPointerEnter={() => dispatchUi({ type: "hover_enter" })}
      onPointerLeave={() => dispatchUi({ type: "hover_leave" })}
      onMouseMove={(event) => {
        if (dragging.current) return;
        const trackRect = trackRef.current?.getBoundingClientRect();
        if (!trackRect) return;
        const x = event.clientX - trackRect.left;
        const clamped = Math.max(0, Math.min(trackRect.width, x));
        computeHoverPreview(clamped, trackRect.width);
      }}
    >
      {showValue && valuePosition === "tooltip" ? (
        <AnimatePresence>
          {isInteracting ? (
            <TooltipValue
              key="tooltip-0"
              value={values[0]}
              formatValue={formatValue}
              motionX={motionX0}
            />
          ) : null}
          {isInteracting && isRange && values[1] !== undefined ? (
            <TooltipValue
              key="tooltip-1"
              value={values[1]}
              formatValue={formatValue}
              motionX={motionX1}
            />
          ) : null}
        </AnimatePresence>
      ) : null}

      <SliderPrimitive.Root
        value={values}
        onValueChange={handleRadixChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={label}
        className="absolute inset-0 opacity-0 pointer-events-none"
        style={{ height: THUMB_SIZE }}
      >
        <SliderPrimitive.Track className="h-full w-full">
          <SliderPrimitive.Range />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className="block outline-none"
          style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
          onFocus={(event) => {
            if (event.currentTarget.matches(":focus-visible")) {
              dispatchUi({ type: "set_focused_thumb", index: 0 });
            }
          }}
          onBlur={() => dispatchUi({ type: "set_focused_thumb", index: null })}
        />
        {isRange ? (
          <SliderPrimitive.Thumb
            className="block outline-none"
            style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
            onFocus={(event) => {
              if (event.currentTarget.matches(":focus-visible")) {
                dispatchUi({ type: "set_focused_thumb", index: 1 });
              }
            }}
            onBlur={() => dispatchUi({ type: "set_focused_thumb", index: null })}
          />
        ) : null}
      </SliderPrimitive.Root>

      <div
        ref={trackRef}
        className="relative w-full cursor-ew-resize py-2"
        style={{ height: THUMB_SIZE + 16, opacity: ready ? 1 : 0 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
      >
        <div
          className="absolute cursor-ew-resize"
          style={{ left: -8, right: -8, top: 0, bottom: 0 }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onLostPointerCapture={handlePointerUp}
        />
        <AnimatePresence>
          {hoverPreview && showHoverTooltip && !isPressed && valuePosition !== "tooltip" ? (
            <m.div
              key="hover-tooltip"
              className="pointer-events-none absolute z-20 -translate-x-1/2"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4, transition: { duration: 0.1 } }}
              transition={springs.fast}
              style={{ left: hoverPreview.cursorX, top: -20 }}
            >
              <span
                className="rounded-md bg-foreground px-2 py-1 text-[12px] text-background tabular-nums whitespace-nowrap"
                style={{ fontVariationSettings: fontWeights.medium }}
              >
                {formatValue(hoverPreview.snappedValue)}
              </span>
            </m.div>
          ) : null}
        </AnimatePresence>
        <m.div
          className={cn(
            "absolute overflow-hidden rounded-full border border-border",
            trackClassName,
          )}
          initial={false}
          animate={{
            height: TRACK_BG_HEIGHT,
            top: 8 + (THUMB_SIZE - TRACK_BG_HEIGHT) / 2,
          }}
          transition={springs.fast}
          style={{
            left: TRACK_INSET,
            right: TRACK_INSET,
            backgroundColor: "transparent",
            ...trackStyle,
          }}
        >
          {!hideFill ? (
            <m.div
              className={cn("absolute h-full bg-selected/50 dark:bg-accent/40", fillClassName)}
              style={{ left: fillLeft, width: fillWidth, ...fillStyle }}
            />
          ) : null}
          <m.div
            className="pointer-events-none absolute z-2 h-full"
            initial={false}
            animate={{ opacity: hoverPreview && !isPressed ? 1 : 0 }}
            transition={{ opacity: { duration: 0.15 } }}
            style={{
              left: hoverPreview ? hoverPreview.left - TRACK_INSET : 0,
              width: hoverPreview ? hoverPreview.width : 0,
              borderRadius:
                hoverPreview && hoverPreview.cursorX > hoverPreview.left
                  ? "0 9999px 9999px 0"
                  : "9999px 0 0 9999px",
              backgroundColor: "color-mix(in srgb, var(--color-accent) 40%, transparent)",
            }}
          />
        </m.div>
        {stepDots.length > 0 ? (
          <m.div
            className="pointer-events-none absolute right-0 left-0"
            style={{
              top: 8 + (THUMB_SIZE - TRACK_BG_HEIGHT) / 2,
              height: TRACK_BG_HEIGHT,
              WebkitMaskImage: stepDotsMask,
              maskImage: stepDotsMask,
            }}
          >
            {stepDots.map(({ value: dotValue, percent }) => (
              <div
                key={dotValue}
                className="pointer-events-none absolute flex items-center justify-center"
                style={{
                  left: `calc(${THUMB_SIZE / 2}px + ${percent} * (100% - ${THUMB_SIZE}px))`,
                  top: "50%",
                  width: 0,
                  height: 0,
                }}
              >
                <m.div
                  className="shrink-0 rounded-full"
                  initial={false}
                  animate={{
                    width: isHovered ? DOT_SIZE * 1.25 : DOT_SIZE,
                    height: isHovered ? DOT_SIZE * 1.25 : DOT_SIZE,
                  }}
                  transition={springs.moderate}
                  style={{ backgroundColor: "var(--muted-foreground)", opacity: 0.3 }}
                />
              </div>
            ))}
          </m.div>
        ) : null}
        <VisualThumb
          index={0}
          motionX={motionX0}
          focusedThumb={focusedThumb}
          thumbColor={thumbColor}
          thumbBorderColor={thumbBorderColor}
        />
        {isRange ? (
          <VisualThumb
            index={1}
            motionX={motionX1}
            focusedThumb={focusedThumb}
            thumbColor={thumbColor}
            thumbBorderColor={thumbBorderColor}
          />
        ) : null}
      </div>
    </div>
  );
}
