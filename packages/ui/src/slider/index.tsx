/* oxlint-disable max-lines, react-doctor/no-giant-component */
"use client";

import { useRef, useState, useEffect, useCallback, useMemo, useReducer } from "react";
import {
  LazyMotion,
  domMax,
  m,
  useMotionValue,
  useTransform,
  animate,
  AnimatePresence,
  type MotionValue,
} from "motion/react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "../lib/utils";
import {
  PIP_SIZE,
  fontWeights,
  springs,
  type SliderComfortableProps,
  type SliderProps,
  type SliderValue,
  type ValuePosition,
} from "./shared";
import { ValueDisplay } from "./value-display";
import { hoverTooltipReducer } from "./primary-state";
import { usePrimarySlider } from "../hooks/use-primary-slider";
import { PrimaryTrack } from "./primary-track";

function Slider({
  ref,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  showSteps = false,
  showValue = true,
  valuePosition = "left",
  formatValue = String,
  label,
  disabled = false,
  trackClassName,
  trackStyle,
  fillClassName,
  fillStyle,
  hideFill = false,
  thumbColor,
  thumbBorderColor,
  className,
  ...props
}: SliderProps) {
  const model = usePrimarySlider({
    value,
    onChange,
    min,
    max,
    step,
    showSteps,
    disabled,
  });
  const { ui, isInteracting } = model;
  const { editingIndex } = ui;

  const valueDisplay =
    showValue && valuePosition !== "tooltip" ? (
      <ValueDisplay
        values={model.values}
        editingIndex={editingIndex}
        onStartEdit={model.handleStartEdit}
        onCommitEdit={model.handleCommitEdit}
        onCancelEdit={model.handleCancelEdit}
        min={min}
        max={max}
        step={step}
        formatValue={formatValue}
        label={label}
        isRange={model.isRange}
        isInteracting={isInteracting}
      />
    ) : null;

  return (
    <LazyMotion features={domMax}>
      <div
        ref={ref}
        className={cn(
          "mb-2 flex w-full touch-none flex-col gap-0 overflow-visible select-none",
          valuePosition === "left" || valuePosition === "right"
            ? "mb-2 flex-row items-center gap-2"
            : "flex-col",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
        {...props}
      >
        {(valuePosition === "top" || valuePosition === "left") && valueDisplay}
        <PrimaryTrack
          valuePosition={valuePosition}
          showValue={showValue}
          formatValue={formatValue}
          label={label}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          trackClassName={trackClassName}
          trackStyle={trackStyle}
          fillClassName={fillClassName}
          fillStyle={fillStyle}
          hideFill={hideFill}
          thumbColor={thumbColor}
          thumbBorderColor={thumbBorderColor}
          isRange={model.isRange}
          values={model.values}
          trackRef={model.trackRef}
          dragging={model.dragging}
          ui={model.ui}
          dispatchUi={model.dispatchUi}
          motionX0={model.motionX0}
          motionX1={model.motionX1}
          fillLeft={model.fillLeft}
          fillWidth={model.fillWidth}
          stepDotsMask={model.stepDotsMask}
          computeHoverPreview={model.computeHoverPreview}
          handlePointerDown={model.handlePointerDown}
          handlePointerMove={model.handlePointerMove}
          handlePointerUp={model.handlePointerUp}
          handleRadixChange={model.handleRadixChange}
          stepDots={model.stepDots}
          isInteracting={isInteracting}
        />
        {(valuePosition === "bottom" || valuePosition === "right") && valueDisplay}
      </div>
    </LazyMotion>
  );
}

// ---------------------------------------------------------------------------
// SliderComfortable
// ---------------------------------------------------------------------------

// oxlint-disable-next-line eslint/complexity
function SliderComfortable({
  ref,
  value,
  onChange,
  onValueCommit,
  min = 0,
  max = 100,
  step = 1,
  variant = "pips",
  label,
  formatValue = String,
  disabled = false,
  className,
  ...props
}: SliderComfortableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const handleDragging = useRef(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [hoverPreview, setHoverPreview] = useState<{
    left: number;
    width: number;
    snappedValue: number;
    cursorX: number;
  } | null>(null);
  const [showHoverTooltip, dispatchHoverTooltip] = useReducer(hoverTooltipReducer, false);

  useEffect(() => {
    if (!isHovered) {
      dispatchHoverTooltip({ type: "leave" });
      return;
    }
    const delayId = window.setTimeout(() => {
      dispatchHoverTooltip({ type: "delay_elapsed" });
    }, 100);
    return () => window.clearTimeout(delayId);
  }, [isHovered]);

  const mergedRef = useCallback(
    (el: HTMLDivElement | null) => {
      containerRef.current = el;
      if (typeof ref === "function") (ref as React.RefCallback<HTMLDivElement>)(el);
      else if (ref) (ref as React.RefObject<HTMLDivElement | null>).current = el;
    },
    [ref],
  );

  const pipSteps = useMemo(
    () => Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + i * step),
    [min, max, step],
  );
  const pipCount = pipSteps.length;

  // Fill motion value
  const fillPercent = useMotionValue(
    max === min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min))),
  );
  // Small offset when value is at min so the handle line stays visible
  const zeroTarget = variant === "pips" ? 8 : 17;
  const zeroOffset = useMotionValue(value === min ? zeroTarget : 0);

  const fillWidthStyle = useTransform(fillPercent, (p) => `${p * 100}%`);
  const handleLeftStyle = useTransform(
    [fillPercent, zeroOffset] as MotionValue<number>[],
    ([p, zo]) => `calc(${(p as number) * 100}% - 8px + ${zo as number}px)`,
  );
  const handleLineLeftStyle = useTransform(
    [fillPercent, zeroOffset] as MotionValue<number>[],
    ([p, zo]) => `calc(${(p as number) * 100}% - 9px + ${zo as number}px)`,
  );
  // Pips-specific: offset by px-3 (12px) padding so fill edge aligns with active pip center
  const pipsFillWidthStyle = useTransform(
    [fillPercent, zeroOffset] as MotionValue<number>[],
    ([p, zo]) =>
      `calc(${(p as number) * 100}% + ${20 - 20 * (p as number) - (zo as number) * 2.5}px)`,
  );
  const pipsHandleLineLeftStyle = useTransform(
    fillPercent,
    (p) => `calc(${p * 100}% + ${11 - 24 * p}px)`,
  );
  const pipsMaskStyle = useTransform(
    [fillPercent, zeroOffset] as MotionValue<number>[],
    ([p, zo]) => {
      const offset = 20 - 20 * (p as number) - (zo as number) * 2.5;
      return `linear-gradient(to right, transparent calc(${(p as number) * 100}% + ${offset}px), black calc(${(p as number) * 100}% + ${offset + 2}px))`;
    },
  );

  // --- Hover preview computation ---
  const computeHoverPreview = useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Use clientWidth (padding box) — CSS % and absolute left/width are relative to it
      const w = el.clientWidth;
      const borderLeft = rect.width - w > 0 ? (rect.width - w) / 2 : 0;
      const x = clientX - rect.left - borderLeft;
      const clamped = Math.max(0, Math.min(w, x));

      // Snap to nearest step value
      let snappedVal: number;
      if (variant === "pips") {
        if (pipCount <= 1) return;
        const index = Math.max(
          0,
          Math.min(pipCount - 1, Math.round((clamped / w) * (pipCount - 1))),
        );
        snappedVal = pipSteps[index];
      } else {
        const raw = min + (clamped / w) * (max - min);
        snappedVal = Math.max(min, Math.min(max, Math.round((raw - min) / step) * step + min));
      }
      const snappedPercent = max === min ? 0 : (snappedVal - min) / (max - min);
      const snappedX = snappedPercent * w;

      // Current handle position — for pips, match the visual fill edge offset
      const currentPercent = fillPercent.get();
      let handleX: number;
      if (variant === "pips") {
        const zo = zeroOffset.get();
        handleX = currentPercent * w + (20 - 20 * currentPercent - zo * 2.5);
      } else {
        handleX = currentPercent * w;
      }

      // Extend hover bar to container edges at extremes so there's no gap
      const edgeX = snappedVal === min ? 0 : snappedVal === max ? w : snappedX;
      const left = Math.min(handleX, edgeX);
      const width = Math.abs(edgeX - handleX);
      setHoverPreview({ left, width, snappedValue: snappedVal, cursorX: snappedX });
    },
    [variant, pipSteps, pipCount, min, max, step, fillPercent, zeroOffset],
  );

  // Sync fill on programmatic value change
  useEffect(() => {
    if (dragging.current || handleDragging.current) return;
    const percent = max === min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
    animate(fillPercent, percent, springs.fast);
    animate(zeroOffset, value === min ? zeroTarget : 0, springs.fast);
  }, [value, min, max, variant, fillPercent, zeroOffset, zeroTarget]);

  const getValueFromX = useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (!el) return min;
      const rect = el.getBoundingClientRect();
      // Match computeHoverPreview + CSS % widths: map in the padding/content box (clientWidth),
      // not border-box width, so pointer position aligns with the fill under `border`.
      const w = el.clientWidth;
      if (w <= 0) return min;
      const borderLeft = rect.width - w > 0 ? (rect.width - w) / 2 : 0;
      const x = clientX - rect.left - borderLeft;
      const clamped = Math.max(0, Math.min(w, x));
      if (variant === "pips") {
        if (pipCount <= 1) return min;
        const index = Math.max(
          0,
          Math.min(pipCount - 1, Math.round((clamped / w) * (pipCount - 1))),
        );
        return pipSteps[index];
      } else {
        const raw = min + (clamped / w) * (max - min);
        const snapped = Math.round((raw - min) / step) * step + min;
        return Math.max(min, Math.min(max, snapped));
      }
    },
    [variant, pipSteps, pipCount, min, max, step],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      dragging.current = true;
      setIsPressed(true);
      const newVal = getValueFromX(e.clientX);
      onChange(newVal);
      const newPercent = Math.max(0, Math.min(1, (newVal - min) / (max - min)));
      animate(fillPercent, newPercent, springs.fast);
      animate(zeroOffset, newVal === min ? zeroTarget : 0, springs.fast);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [disabled, getValueFromX, onChange, fillPercent, zeroOffset, zeroTarget, min, max],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const newVal = getValueFromX(e.clientX);
      onChange(newVal);
      const newPercent = Math.max(0, Math.min(1, (newVal - min) / (max - min)));
      if (variant === "scrubber") {
        fillPercent.set(newPercent);
      } else {
        animate(fillPercent, newPercent, springs.fast);
      }
      animate(zeroOffset, newVal === min ? zeroTarget : 0, springs.fast);
    },
    [getValueFromX, onChange, variant, fillPercent, zeroOffset, zeroTarget, min, max],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragging.current) {
        const newVal = getValueFromX(e.clientX);
        onChange(newVal);
        const newPercent = Math.max(0, Math.min(1, (newVal - min) / (max - min)));
        if (variant === "scrubber") {
          fillPercent.set(newPercent);
        } else {
          animate(fillPercent, newPercent, springs.fast);
        }
        animate(zeroOffset, newVal === min ? zeroTarget : 0, springs.fast);
        onValueCommit?.(newVal);
      }
      dragging.current = false;
      setIsPressed(false);
      setHoverPreview(null);
    },
    [
      fillPercent,
      getValueFromX,
      max,
      min,
      onChange,
      onValueCommit,
      variant,
      zeroOffset,
      zeroTarget,
    ],
  );

  // Resize handle drag handlers (direct cursor position)
  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      handleDragging.current = true;
      setIsPressed(true);
      const newVal = getValueFromX(e.clientX);
      onChange(newVal);
      fillPercent.set(Math.max(0, Math.min(1, (newVal - min) / (max - min))));
      animate(zeroOffset, newVal === min ? zeroTarget : 0, springs.fast);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [disabled, getValueFromX, onChange, fillPercent, zeroOffset, zeroTarget, min, max],
  );

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!handleDragging.current) return;
      const newVal = getValueFromX(e.clientX);
      onChange(newVal);
      fillPercent.set(Math.max(0, Math.min(1, (newVal - min) / (max - min))));
      animate(zeroOffset, newVal === min ? zeroTarget : 0, springs.fast);
    },
    [getValueFromX, onChange, fillPercent, zeroOffset, zeroTarget, min, max],
  );

  const handleResizePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (handleDragging.current) {
        const newVal = getValueFromX(e.clientX);
        onChange(newVal);
        fillPercent.set(Math.max(0, Math.min(1, (newVal - min) / (max - min))));
        animate(zeroOffset, newVal === min ? zeroTarget : 0, springs.fast);
        onValueCommit?.(newVal);
      }
      handleDragging.current = false;
      setIsPressed(false);
      setHoverPreview(null);
    },
    [fillPercent, getValueFromX, max, min, onChange, onValueCommit, zeroOffset, zeroTarget],
  );

  const handleRadixChange = useCallback(
    (newValues: number[]) => {
      const nextValue = newValues[0] ?? min;
      onChange(nextValue);
      onValueCommit?.(nextValue);
    },
    [min, onChange, onValueCommit],
  );

  const isActive = isHovered || isFocused;

  return (
    <LazyMotion features={domMax}>
      <div
        className="relative w-full touch-none"
        onPointerEnter={() => {
          if (!disabled) setIsHovered(true);
        }}
        onPointerLeave={() => {
          if (!disabled) {
            setIsHovered(false);
            setHoverPreview(null);
          }
        }}
        onMouseMove={(e) => {
          if (disabled || dragging.current || handleDragging.current) return;
          computeHoverPreview(e.clientX);
        }}
      >
        {/* Extended hit area — 8px beyond each edge */}
        <div
          className="absolute cursor-ew-resize"
          style={{ left: -8, right: -8, top: 0, bottom: 0 }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerCancel={handlePointerUp}
          onPointerUp={handlePointerUp}
        />
        {/* Hover value tooltip — outside overflow-hidden container */}
        <AnimatePresence>
          {hoverPreview && showHoverTooltip && !isPressed && (
            <m.div
              key="hover-tooltip"
              className="absolute -translate-x-1/2 pointer-events-none z-20"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4, transition: { duration: 0.1 } }}
              transition={springs.fast}
              style={{
                left: hoverPreview.cursorX,
                top: -30,
              }}
            >
              <span
                className="whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[12px] text-background tabular-nums"
                style={{ fontVariationSettings: fontWeights.medium }}
              >
                {formatValue(hoverPreview.snappedValue)}
              </span>
            </m.div>
          )}
        </AnimatePresence>

        <m.div
          ref={mergedRef}
          className={cn(
            "relative w-full h-8 select-none touch-none border border-border overflow-hidden outline-offset-2",
            variant === "scrubber"
              ? "flex items-center gap-3 px-4 cursor-ew-resize"
              : "cursor-ew-resize",
            "rounded-lg bg-background not-dark:bg-clip-padding shadow-xs/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:bg-input/32 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
            disabled && "opacity-50 pointer-events-none",
            className,
          )}
          initial={false}
          animate={{
            outline: isFocused ? "1px solid #6B97FF" : "1px solid transparent",
          }}
          transition={springs.fast}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerCancel={handlePointerUp}
          onPointerUp={handlePointerUp}
          {...props}
        >
          {/* Invisible Radix for keyboard nav + a11y */}
          <SliderPrimitive.Root
            value={[value]}
            onValueChange={handleRadixChange}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            className="absolute inset-0 opacity-0 pointer-events-none **:pointer-events-none"
          >
            <SliderPrimitive.Track className="w-full h-full">
              <SliderPrimitive.Range />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb
              className="block outline-none"
              onFocus={(e) => {
                if (e.currentTarget.matches(":focus-visible")) setIsFocused(true);
              }}
              onBlur={() => setIsFocused(false)}
            />
          </SliderPrimitive.Root>

          {/* Hover preview */}
          <m.div
            className="absolute inset-y-0 pointer-events-none z-3"
            initial={false}
            animate={{
              opacity: hoverPreview && !isPressed ? 1 : 0,
            }}
            transition={{ opacity: { duration: 0.15 } }}
            style={{
              left: hoverPreview ? hoverPreview.left : 0,
              width: hoverPreview ? hoverPreview.width : 0,
              backgroundColor: "color-mix(in srgb, var(--color-accent) 40%, transparent)",
            }}
          />

          {/* Pips: dots layer — z-[1] */}
          {variant === "pips" && (
            <m.div
              className="absolute inset-0 flex justify-between items-center px-3 pointer-events-none z-1"
              style={{ WebkitMaskImage: pipsMaskStyle, maskImage: pipsMaskStyle }}
            >
              {pipSteps.map((pipValue) => {
                const isActivePip = pipValue === value;
                return (
                  <div
                    key={pipValue}
                    className="relative flex items-center justify-center"
                    style={{ width: PIP_SIZE, height: PIP_SIZE }}
                  >
                    <m.div
                      className="rounded-full"
                      initial={false}
                      animate={{
                        backgroundColor: isActivePip
                          ? "var(--foreground)"
                          : "var(--muted-foreground)",
                        opacity: isActivePip ? 1 : 0.3,
                      }}
                      transition={springs.fast}
                      style={{ width: PIP_SIZE, height: PIP_SIZE }}
                    />
                  </div>
                );
              })}
            </m.div>
          )}

          {/* Pips: label + value BG layer — z-[2] (occludes dots behind text) */}
          {variant === "pips" && (
            <div
              className="absolute inset-0 flex items-center px-2 z-2 pointer-events-none"
              aria-hidden
            >
              {label && (
                <span className="text-[13px] px-2 bg-background text-transparent select-none">
                  {label}
                </span>
              )}
              <span
                className="text-[13px] tabular-nums ml-auto px-2 bg-background text-transparent select-none"
                style={{ minWidth: `${String(formatValue(max)).length}ch` }}
              >
                {formatValue(value)}
              </span>
            </div>
          )}

          {/* Pips: fill — z-[3] */}
          {variant === "pips" && (
            <m.div
              className="absolute left-0 top-0 bottom-0 pointer-events-none z-3"
              style={{
                width: pipsFillWidthStyle,
                backgroundColor: "color-mix(in srgb, var(--foreground) 8%, transparent)",
              }}
            />
          )}

          {/* Pips: handle line — z-[3] */}
          {variant === "pips" && (
            <m.div
              className="absolute rounded-full pointer-events-none z-3"
              initial={false}
              animate={{
                top: isActive ? 7 : 8,
                bottom: isActive ? 7 : 8,
                backgroundColor: isFocused
                  ? "var(--foreground)"
                  : isHovered
                    ? "color-mix(in srgb, var(--foreground) 50%, transparent)"
                    : "color-mix(in srgb, var(--foreground) 25%, transparent)",
              }}
              transition={springs.fast}
              style={{
                left: pipsHandleLineLeftStyle,
                width: 2,
              }}
            />
          )}

          {/* Pips: label + value text layer — z-[4] */}
          {variant === "pips" && (
            <div className="absolute inset-0 flex items-center px-2 z-4 pointer-events-none">
              {label && (
                <m.span
                  className="text-[13px] px-2"
                  initial={false}
                  animate={{ color: isActive ? "var(--foreground)" : "var(--muted-foreground)" }}
                  transition={springs.fast}
                >
                  {label}
                </m.span>
              )}
              <m.span
                className="text-[13px] tabular-nums ml-auto px-2"
                initial={false}
                animate={{ color: isActive ? "var(--foreground)" : "var(--muted-foreground)" }}
                transition={springs.fast}
                style={{ minWidth: `${String(formatValue(max)).length}ch`, textAlign: "right" }}
              >
                {formatValue(value)}
              </m.span>
            </div>
          )}

          {/* Scrubber: fill */}
          {variant === "scrubber" && (
            <m.div
              className="absolute left-0 top-0 bottom-0 pointer-events-none"
              style={{
                width: fillWidthStyle,
                backgroundColor: "color-mix(in srgb, var(--foreground) 8%, transparent)",
              }}
            />
          )}

          {/* Scrubber: handle line */}
          {variant === "scrubber" && (
            <m.div
              className="absolute rounded-full pointer-events-none z-10"
              initial={false}
              animate={{
                top: isActive ? 7 : 8,
                bottom: isActive ? 7 : 8,
                backgroundColor: isFocused
                  ? "var(--foreground)"
                  : isHovered
                    ? "color-mix(in srgb, var(--foreground) 50%, transparent)"
                    : "color-mix(in srgb, var(--foreground) 25%, transparent)",
              }}
              transition={springs.fast}
              style={{
                left: handleLineLeftStyle,
                width: 2,
              }}
            />
          )}

          {/* Scrubber: label */}
          {variant === "scrubber" && label && (
            <m.span
              className="text-[13px] shrink-0 z-10"
              initial={false}
              animate={{ color: isActive ? "var(--foreground)" : "var(--muted-foreground)" }}
              transition={springs.fast}
            >
              {label}
            </m.span>
          )}

          {/* Scrubber: flex-1 spacer + value */}
          {variant === "scrubber" && (
            <>
              <div className="flex-1" />
              <m.span
                className="text-sm shrink-0 tabular-nums [font-variant-numeric:tabular-nums] text-right z-10"
                initial={false}
                animate={{ color: isActive ? "var(--foreground)" : "var(--muted-foreground)" }}
                transition={springs.fast}
                style={{ minWidth: `${String(formatValue(max)).length}ch` }}
              >
                {formatValue(value)}
              </m.span>
            </>
          )}

          {/* Resize handle (scrubber only) */}
          {variant === "scrubber" && (
            <m.div
              className="absolute top-0 bottom-0 w-2 cursor-ew-resize z-20"
              style={{ left: handleLeftStyle }}
              onPointerDown={handleResizePointerDown}
              onPointerMove={handleResizePointerMove}
              onPointerCancel={handleResizePointerUp}
              onPointerUp={handleResizePointerUp}
            />
          )}
        </m.div>
      </div>
    </LazyMotion>
  );
}

export { Slider, SliderComfortable };
export type { SliderProps, SliderValue, ValuePosition, SliderComfortableProps };
