/* oxlint-disable react-doctor/only-export-components */
"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import type * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clamp,
  createScrubberMotion,
  paintScrubber,
  rubberBand,
  SCRUBBER_MAX_PITCH,
  type ScrubberLayout,
  type ScrubberMotion,
  type ScrubberRange,
  slotCount,
} from "../lib/scrubber";
import { cn } from "../lib/utils";

export type { ScrubberRange } from "../lib/scrubber";
export {
  type ScrubberScrollBinding,
  type UseScrubberScrollOptions,
  useScrubberScroll,
} from "../hooks/use-scrubber-scroll";

export type ScrubberChangeEventDetails = SliderPrimitive.Root.ChangeEventDetails;

export interface ScrubberProps extends Omit<
  SliderPrimitive.Root.Props<number>,
  | "children"
  | "defaultValue"
  | "largeStep"
  | "max"
  | "min"
  | "onValueChange"
  | "orientation"
  | "step"
  | "value"
> {
  /** Number of items the scrubber indexes. */
  count: number;
  /** Selected item index. */
  value?: number;
  /** Initial index when uncontrolled. Defaults to the last item. */
  defaultValue?: number;
  onValueChange?: (value: number, eventDetails: ScrubberChangeEventDetails) => void;
  /** Visible window of the controlled view. Ticks inside it read darker and form the thumb. */
  range?: ScrubberRange;
  /** Indices that start a new group, such as the first item of each month. */
  groups?: readonly number[];
  /** Items moved by PageUp and PageDown. Defaults to 10% of `count`. */
  largeStep?: number;
  /** Accessible text for an index, for example `"Oct 15, Zaytinya"`. */
  getAriaValueText?: (index: number) => string;
  /** Content of the floating label above the hovered or keyboard-focused tick. */
  getLabel?: (index: number) => React.ReactNode;
  /** Called when the item under the pointer changes, and with `null` when the pointer leaves. */
  onPreviewChange?: (index: number | null) => void;
  "aria-label"?: string;
}

function usePrefersReducedMotion(): React.RefObject<boolean> {
  const reduced = useRef(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reduced.current = query.matches;
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return reduced;
}

function useElementWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

function isFocusVisible(element: Element): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}

function isInside(element: Element | null, event: PointerEvent): boolean {
  const rect = element?.getBoundingClientRect();
  return (
    rect !== undefined &&
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom
  );
}

interface PointerOptions {
  controlRef: React.RefObject<HTMLDivElement | null>;
  motion: React.RefObject<ScrubberMotion>;
  last: number;
  disabled: boolean;
  schedule: () => void;
  onPreview: (index: number | null) => void;
}

/** Hover magnification, drag tracking past the ends, and preview reporting. */
function useScrubberPointer({
  controlRef,
  motion,
  last,
  disabled,
  schedule,
  onPreview,
}: PointerOptions) {
  const drag = useRef<AbortController | null>(null);
  useEffect(() => () => drag.current?.abort(), []);

  const track = (clientX: number) => {
    const rect = controlRef.current?.getBoundingClientRect();
    if (!rect) return;
    const state = motion.current;
    const x = clientX - rect.left;
    const overshoot = x < 0 ? x : Math.max(0, x - rect.width);
    state.pointerX = x;
    state.targetPop = 1;
    state.targetOverscroll = state.dragging ? rubberBand(overshoot) : 0;
    if (rect.width > 0) onPreview(Math.round(clamp(x / rect.width, 0, 1) * last));
    schedule();
  };

  const leave = () => {
    const state = motion.current;
    state.pointerX = null;
    state.targetPop = state.focusVisible ? 1 : 0;
    onPreview(null);
    schedule();
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return;
    const state = motion.current;
    state.dragging = true;
    track(event.clientX);
    drag.current?.abort();
    const controller = new AbortController();
    drag.current = controller;
    const { signal } = controller;
    const end = (endEvent: PointerEvent) => {
      controller.abort();
      state.dragging = false;
      state.targetOverscroll = 0;
      if (endEvent.pointerType === "touch" || !isInside(controlRef.current, endEvent)) leave();
      else schedule();
    };
    // Keep tracking outside the control so a drag past either end can rubber-band.
    window.addEventListener("pointermove", (moveEvent) => track(moveEvent.clientX), { signal });
    window.addEventListener("pointerup", end, { signal });
    window.addEventListener("pointercancel", end, { signal });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!disabled && !motion.current.dragging) track(event.clientX);
  };

  const onPointerLeave = () => {
    if (!motion.current.dragging) leave();
  };

  return { onPointerDown, onPointerLeave, onPointerMove };
}

export function Scrubber({
  count,
  value: valueProp,
  defaultValue,
  onValueChange,
  range,
  groups,
  largeStep,
  getAriaValueText,
  getLabel,
  onPreviewChange,
  disabled = false,
  className,
  "aria-label": ariaLabel,
  ...props
}: ScrubberProps): React.ReactElement {
  const last = Math.max(0, count - 1);
  const [uncontrolledValue, setUncontrolledValue] = useState(() =>
    clamp(defaultValue ?? last, 0, last),
  );
  const value = clamp(valueProp ?? uncontrolledValue, 0, last);

  const controlRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const tickRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const separatorRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [initialMotion] = useState(createScrubberMotion);
  const motion = useRef<ScrubberMotion>(initialMotion);
  const reducedMotion = usePrefersReducedMotion();
  const width = useElementWidth(controlRef);
  const slots = slotCount(count, width);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [focusVisible, setFocusVisible] = useState(false);

  const separators = useMemo(
    () => (groups ?? []).filter((index) => index > 0 && index <= last),
    [groups, last],
  );
  const layout = useRef<ScrubberLayout>({ width, slots, last, value, range, separators });
  useEffect(() => {
    layout.current = { width, slots, last, value, range, separators };
  });

  const paint = useCallback(
    (now: number) => {
      const elements = {
        ticks: tickRefs.current,
        separators: separatorRefs.current,
        field: fieldRef.current,
        label: labelRef.current,
      };
      const settling = paintScrubber(
        motion.current,
        layout.current,
        elements,
        reducedMotion.current,
        now,
      );
      motion.current.frame = settling ? requestAnimationFrame(paint) : 0;
    },
    [reducedMotion],
  );

  const schedule = useCallback(() => {
    motion.current.frame ||= requestAnimationFrame(paint);
  }, [paint]);

  useEffect(() => {
    schedule();
  }, [schedule, width, slots, value, range, separators]);

  useEffect(() => {
    const state = motion.current;
    return () => cancelAnimationFrame(state.frame);
  }, []);

  const preview = useRef<number | null>(null);
  const onPreview = useCallback(
    (next: number | null) => {
      if (preview.current === next) return;
      preview.current = next;
      setPreviewIndex(next);
      onPreviewChange?.(next);
    },
    [onPreviewChange],
  );

  const pointer = useScrubberPointer({
    controlRef,
    motion,
    last,
    disabled,
    schedule,
    onPreview,
  });

  const setFocus = (visible: boolean) => {
    const state = motion.current;
    state.focusVisible = visible;
    state.targetPop = visible || state.pointerX !== null ? 1 : 0;
    setFocusVisible(visible);
    schedule();
  };

  const labelIndex = previewIndex ?? (focusVisible ? value : null);
  const label = labelIndex === null ? undefined : getLabel?.(labelIndex);

  return (
    <SliderPrimitive.Root
      className={cn(
        "relative w-full touch-none select-none data-disabled:pointer-events-none data-disabled:opacity-64",
        className,
      )}
      data-slot="scrubber"
      disabled={disabled}
      largeStep={largeStep ?? Math.max(1, Math.round(count / 10))}
      max={last}
      min={0}
      step={1}
      thumbAlignment="center"
      value={value}
      onValueChange={(next, eventDetails) => {
        if (valueProp === undefined) setUncontrolledValue(next);
        onValueChange?.(next, eventDetails);
      }}
      {...props}
    >
      <SliderPrimitive.Control
        className="relative mx-auto h-11 w-full cursor-pointer outline-none before:pointer-events-none before:absolute before:inset-y-0 before:-inset-x-3 before:rounded-lg has-focus-visible:before:ring-2 has-focus-visible:before:ring-ring"
        data-slot="scrubber-control"
        ref={controlRef}
        style={{ maxWidth: last * SCRUBBER_MAX_PITCH }}
        {...pointer}
      >
        <div aria-hidden className="absolute inset-0" data-slot="scrubber-field" ref={fieldRef}>
          {Array.from({ length: slots }, (_, slot) => (
            <span
              className="pointer-events-none absolute top-1/2 -mt-1 -ml-[1.5px] h-2 w-[3px] rounded-full bg-foreground opacity-16 data-preview:bg-highlight"
              data-slot="scrubber-tick"
              // oxlint-disable-next-line react/no-array-index-key -- a slot is a position, stable for a given width
              key={slot}
              ref={(node) => {
                tickRefs.current[slot] = node;
              }}
              style={{ left: slots > 1 ? `${(slot / (slots - 1)) * 100}%` : "50%" }}
            />
          ))}
          {separators.map((index, position) => (
            <span
              className="pointer-events-none absolute top-1/2 -mt-1.5 h-3 w-px rounded-full bg-foreground opacity-32"
              data-slot="scrubber-separator"
              key={index}
              ref={(node) => {
                separatorRefs.current[position] = node;
              }}
              style={{ left: last > 0 ? `${((index - 0.5) / last) * 100}%` : "50%" }}
            />
          ))}
        </div>
        {getLabel ? (
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-full left-0 mb-1 origin-bottom scale-96 whitespace-nowrap rounded-md bg-popover px-2 py-1 font-medium text-popover-foreground text-xs tabular-nums opacity-0 shadow-sm/5 transition-[opacity,scale] duration-150 ease-out-quint data-visible:scale-100 data-visible:opacity-100 motion-reduce:transition-none"
            data-slot="scrubber-label"
            data-visible={label === undefined ? undefined : ""}
            ref={labelRef}
          >
            {label}
          </div>
        ) : null}
        <SliderPrimitive.Thumb
          aria-label={ariaLabel}
          className="absolute inset-y-0 w-px opacity-0 outline-none"
          data-slot="scrubber-thumb"
          getAriaValueText={
            getAriaValueText ? (_, itemIndex) => getAriaValueText(itemIndex) : undefined
          }
          onBlur={() => setFocus(false)}
          onFocus={(event) => setFocus(isFocusVisible(event.currentTarget))}
        />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}
