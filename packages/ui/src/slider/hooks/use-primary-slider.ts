/* oxlint-disable react-doctor/no-event-handler, react-doctor/exhaustive-deps */
"use client";

import { useRef, useEffect, useLayoutEffect, useCallback, useMemo, useReducer } from "react";
import { useMotionValue, useTransform, animate, type MotionValue } from "motion/react";
import {
  pixelToValue,
  springs,
  THUMB_SIZE,
  TRACK_INSET,
  toRadixValue,
  valueToPixel,
  type SliderValue,
} from "../lib/model";
import { initialPrimarySliderUiState, primarySliderUiReducer } from "../lib/primary-state";

export function usePrimarySlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  showSteps = false,
  disabled = false,
}: {
  value: SliderValue;
  onChange: (value: SliderValue) => void;
  min?: number;
  max?: number;
  step?: number;
  showSteps?: boolean;
  disabled?: boolean;
}) {
  const isRange = Array.isArray(value);
  const values = toRadixValue(value);

  // --- Refs ---
  const trackRef = useRef<HTMLDivElement>(null);
  const trackWidthRef = useRef(0);
  const dragging = useRef(false);
  const activeDragThumb = useRef<number>(0);
  const valuesRef = useRef(values);
  const minRef = useRef(min);
  const maxRef = useRef(max);
  valuesRef.current = values;
  minRef.current = min;
  maxRef.current = max;

  // --- State ---
  const [ui, dispatchUi] = useReducer(primarySliderUiReducer, initialPrimarySliderUiState);
  const { isHovered, isPressed } = ui;

  useEffect(() => {
    if (!isHovered) {
      dispatchUi({ type: "tooltip_hide" });
      return;
    }
    const delayId = window.setTimeout(() => {
      dispatchUi({ type: "tooltip_show" });
    }, 100);
    return () => window.clearTimeout(delayId);
  }, [isHovered]);

  // --- Motion values ---
  const motionX0 = useMotionValue(0);
  const motionX1 = useMotionValue(0);

  // --- Derived motion values for fill ---
  const fillLeft = useTransform(motionX0, (x) => (isRange ? x + THUMB_SIZE / 2 - TRACK_INSET : 0));
  const fillWidthSingle = useTransform(motionX0, (x) => x + THUMB_SIZE / 2 - TRACK_INSET);
  const fillWidthRange = useTransform(
    [motionX0, motionX1] as MotionValue<number>[],
    ([x0, x1]) => (x1 as number) - (x0 as number),
  );
  const fillWidth = isRange ? fillWidthRange : fillWidthSingle;

  // --- Step dots mask (hides dots on filled side, like SliderComfortable pips) ---
  const stepDotsMaskSingle = useTransform(motionX0, (x) => {
    const edge = x + THUMB_SIZE / 2;
    return `linear-gradient(to right, transparent ${edge}px, black ${edge + 2}px)`;
  });
  const stepDotsMaskRange = useTransform(
    [motionX0, motionX1] as MotionValue<number>[],
    ([x0, x1]) => {
      const left = (x0 as number) + THUMB_SIZE / 2;
      const right = (x1 as number) + THUMB_SIZE / 2;
      return `linear-gradient(to right, black ${left - 2}px, transparent ${left}px, transparent ${right}px, black ${right + 2}px)`;
    },
  );
  const stepDotsMask = isRange ? stepDotsMaskRange : stepDotsMaskSingle;

  // --- Hover preview computation ---
  const computeHoverPreview = useCallback(
    (cursorX: number, trackWidth: number) => {
      // Snap cursor to step grid (using same usable-width coordinate system as thumb/dots)
      const usable = trackWidth - THUMB_SIZE;
      const rawPx = cursorX - THUMB_SIZE / 2;
      const clampedPx = Math.max(0, Math.min(usable, rawPx));
      const rawVal = usable > 0 ? (clampedPx / usable) * (max - min) + min : min;
      const snappedVal = Math.max(
        min,
        Math.min(max, Math.round((rawVal - min) / step) * step + min),
      );
      const snappedPercent = max === min ? 0 : (snappedVal - min) / (max - min);
      const snappedX = THUMB_SIZE / 2 + snappedPercent * usable;

      // Find nearest thumb center
      const c0 = motionX0.get() + THUMB_SIZE / 2;
      const c1 = motionX1.get() + THUMB_SIZE / 2;
      const nearestIdx = isRange ? (Math.abs(snappedX - c0) <= Math.abs(snappedX - c1) ? 0 : 1) : 0;
      const nearest = nearestIdx === 0 ? c0 : c1;

      // Extend hover bar to track edges at extremes so there's no gap
      const edgeX = snappedVal === min ? 0 : snappedVal === max ? trackWidth : snappedX;
      const left = Math.min(nearest, edgeX);
      const width = Math.abs(edgeX - nearest);
      dispatchUi({
        type: "set_hover_preview",
        preview: { left, width, snappedValue: snappedVal, cursorX: snappedX },
      });
    },
    [min, max, step, isRange, motionX0, motionX1],
  );

  // --- Initial sync (before paint) ---
  const initialSyncDone = useRef(false);
  // oxlint-disable-next-line react-doctor/exhaustive-deps -- mount-only sync; subsequent updates handled by effect below
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el || initialSyncDone.current) return;
    const w = el.getBoundingClientRect().width;
    trackWidthRef.current = w;
    const px0 = valueToPixel(values[0], min, max, w);
    motionX0.set(px0);
    if (isRange && values[1] !== undefined) {
      const px1 = valueToPixel(values[1], min, max, w);
      motionX1.set(px1);
    }
    initialSyncDone.current = true;
    dispatchUi({ type: "mark_ready" });
  }, []);

  // --- Track width measurement (resize only) ---
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (Math.abs(trackWidthRef.current - w) < 0.5) {
        return;
      }
      trackWidthRef.current = w;
      if (!dragging.current && initialSyncDone.current) {
        const v = valuesRef.current;
        const mn = minRef.current;
        const mx = maxRef.current;
        const px0 = valueToPixel(v[0], mn, mx, w);
        animate(motionX0, px0, springs.moderate);
        if (isRange && v[1] !== undefined) {
          const px1 = valueToPixel(v[1], mn, mx, w);
          animate(motionX1, px1, springs.moderate);
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isRange, motionX0, motionX1]);

  // --- Sync motion values on value change (keyboard, programmatic) ---
  useEffect(() => {
    if (!initialSyncDone.current) return;
    if (dragging.current) return;
    const tw = trackWidthRef.current;
    if (tw <= 0) return;
    const px0 = valueToPixel(values[0], min, max, tw);
    animate(motionX0, px0, springs.moderate);
    if (isRange && values[1] !== undefined) {
      const px1 = valueToPixel(values[1], min, max, tw);
      animate(motionX1, px1, springs.moderate);
    }
  }, [values, min, max, isRange, motionX0, motionX1]);

  // --- Range crossing prevention ---
  const clampForRange = useCallback(
    (px: number, thumbIndex: number): number => {
      if (!isRange) return px;
      if (thumbIndex === 0) {
        return Math.min(px, motionX1.get() - THUMB_SIZE * 0.5);
      } else {
        return Math.max(px, motionX0.get() + THUMB_SIZE * 0.5);
      }
    },
    [isRange, motionX0, motionX1],
  );

  // --- Emit value change ---
  const emitChange = useCallback(
    (thumbIndex: number, newValue: number) => {
      if (isRange) {
        const newValues: [number, number] = [...(values as [number, number])];
        newValues[thumbIndex] = newValue;
        onChange(newValues);
      } else {
        onChange(newValue);
      }
    },
    [isRange, values, onChange],
  );

  // --- Pointer handlers on track ---
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation(); // Prevent Radix from also handling the drag

      const trackRect = trackRef.current?.getBoundingClientRect();
      if (!trackRect) return;

      const localX = e.clientX - trackRect.left - THUMB_SIZE / 2;
      const clamped = Math.max(0, Math.min(trackRect.width - THUMB_SIZE, localX));

      // Determine which thumb to drag
      if (isRange) {
        const dist0 = Math.abs(clamped - motionX0.get());
        const dist1 = Math.abs(clamped - motionX1.get());
        activeDragThumb.current = dist0 <= dist1 ? 0 : 1;
      } else {
        activeDragThumb.current = 0;
      }

      dragging.current = true;
      dispatchUi({ type: "press_start" });

      const motionX = activeDragThumb.current === 0 ? motionX0 : motionX1;

      // Snap to step grid immediately
      const snappedValue = pixelToValue(clamped, min, max, step, trackRect.width);
      const snappedPx = valueToPixel(snappedValue, min, max, trackRect.width);

      // Clamp for range crossing
      const finalPx = clampForRange(snappedPx, activeDragThumb.current);
      // Spring-animate thumb to clicked position
      animate(motionX, finalPx, springs.moderate);

      // Update value
      const finalValue = pixelToValue(finalPx, min, max, step, trackRect.width);
      emitChange(activeDragThumb.current, finalValue);

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [disabled, isRange, min, max, step, motionX0, motionX1, clampForRange, emitChange],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      e.stopPropagation();
      const trackRect = trackRef.current?.getBoundingClientRect();
      if (!trackRect) return;

      const localX = e.clientX - trackRect.left - THUMB_SIZE / 2;
      const clamped = Math.max(0, Math.min(trackRect.width - THUMB_SIZE, localX));

      const motionX = activeDragThumb.current === 0 ? motionX0 : motionX1;

      // Snap to step grid during drag
      const snappedValue = pixelToValue(clamped, min, max, step, trackRect.width);
      const snappedPx = valueToPixel(snappedValue, min, max, trackRect.width);
      const finalPx = clampForRange(snappedPx, activeDragThumb.current);
      motionX.set(finalPx);

      const finalValue = pixelToValue(finalPx, min, max, step, trackRect.width);
      emitChange(activeDragThumb.current, finalValue);
    },
    [min, max, step, motionX0, motionX1, clampForRange, emitChange],
  );

  const handlePointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    dispatchUi({ type: "press_end" });
    dispatchUi({ type: "set_hover_preview", preview: null });

    // Spring settle to final quantized position
    const tw = trackWidthRef.current;
    const motionX = activeDragThumb.current === 0 ? motionX0 : motionX1;
    const currentPx = motionX.get();
    const snapped = pixelToValue(currentPx, min, max, step, tw);
    const snappedPx = valueToPixel(snapped, min, max, tw);
    animate(motionX, snappedPx, springs.moderate);
  }, [min, max, step, motionX0, motionX1]);

  // --- Radix keyboard handler ---
  const handleRadixChange = useCallback(
    (newValues: number[]) => {
      if (dragging.current) return;
      if (isRange) {
        onChange(newValues as [number, number]);
      } else {
        onChange(newValues[0]);
      }
    },
    [isRange, onChange],
  );

  // --- Click-to-edit handlers ---
  const handleStartEdit = useCallback((index: number) => {
    dispatchUi({ type: "start_edit", index });
  }, []);

  const handleCommitEdit = useCallback(
    (index: number, v: number) => {
      emitChange(index, v);
      dispatchUi({ type: "end_edit" });
    },
    [emitChange],
  );

  const handleCancelEdit = useCallback(() => {
    dispatchUi({ type: "end_edit" });
  }, []);

  // --- Step dots ---
  const stepDots = useMemo(
    () =>
      showSteps
        ? Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => {
            const v = min + i * step;
            const percent = (v - min) / (max - min);
            return { value: v, percent };
          })
        : [],
    [showSteps, min, max, step],
  );

  // --- Interaction state for tooltip ---
  const isInteracting = isHovered || isPressed;

  return {
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
    handleStartEdit,
    handleCommitEdit,
    handleCancelEdit,
    stepDots,
    isInteracting,
  };
}
