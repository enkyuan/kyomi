"use client";

import type { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { clamp, type ScrubberRange } from "../lib/scrubber";

export interface UseScrubberScrollOptions {
  /** Selector for the scroller's items, in order. Defaults to `[data-scrubber-item]`. */
  itemSelector?: string;
}

export interface ScrubberScrollBinding {
  count: number;
  value: number;
  range: ScrubberRange;
  onValueChange: (value: number, eventDetails?: SliderPrimitive.Root.ChangeEventDetails) => void;
}

interface ItemEdges {
  starts: number[];
  ends: number[];
}

function measureItems(scroller: HTMLElement, selector: string): ItemEdges {
  const origin = scroller.getBoundingClientRect().left - scroller.scrollLeft;
  const starts: number[] = [];
  const ends: number[] = [];
  for (const item of scroller.querySelectorAll<HTMLElement>(selector)) {
    const rect = item.getBoundingClientRect();
    starts.push(rect.left - origin);
    ends.push(rect.right - origin);
  }
  return { starts, ends };
}

/** Fractional index of a scroll edge, where item `i` spans `[i - 0.5, i + 0.5]`. */
function edgeIndex({ starts, ends }: ItemEdges, edge: number): number {
  const index = ends.findIndex((end) => end > edge);
  // Trailing padding can put the edge past every item.
  if (index === -1) return starts.length - 0.5;
  const start = starts[index] ?? 0;
  const size = Math.max(1, (ends[index] ?? start + 1) - start);
  return index - 0.5 + clamp((edge - start) / size, 0, 1);
}

function nearestIndex({ starts, ends }: ItemEdges, middle: number): number {
  let nearest = 0;
  let best = Number.POSITIVE_INFINITY;
  starts.forEach((start, index) => {
    const distance = Math.abs((start + (ends[index] ?? start)) / 2 - middle);
    if (distance < best) {
      best = distance;
      nearest = index;
    }
  });
  return nearest;
}

interface ScrollPosition {
  count: number;
  value: number;
  range: ScrubberRange;
}

const samePosition = (a: ScrollPosition, b: ScrollPosition): boolean =>
  a.value === b.value &&
  a.count === b.count &&
  Math.abs(a.range[0] - b.range[0]) < 0.01 &&
  Math.abs(a.range[1] - b.range[1]) < 0.01;

/**
 * Pairs a `Scrubber` with a native horizontal scroller whose scrollbar is hidden
 * (`scrollbar-width: none`). Reads are rAF-coalesced; while a programmatic glide runs, `value`
 * holds the destination so assistive technology hears one change instead of every item passed.
 */
export function useScrubberScroll(
  scrollerRef: RefObject<HTMLElement | null>,
  { itemSelector = "[data-scrubber-item]" }: UseScrubberScrollOptions = {},
): ScrubberScrollBinding {
  const [position, setPosition] = useState<ScrollPosition>({
    count: 0,
    value: 0,
    range: [-0.5, 0.5],
  });
  const items = useRef<ItemEdges>({ starts: [], ends: [] });
  const target = useRef<number | null>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let frame = 0;

    const read = () => {
      frame = 0;
      const edges = items.current;
      if (edges.starts.length === 0) return;
      const left = scroller.scrollLeft;
      const right = left + scroller.clientWidth;
      const nearest = nearestIndex(edges, (left + right) / 2);
      if (target.current === nearest) target.current = null;
      const next: ScrollPosition = {
        count: edges.starts.length,
        value: target.current ?? nearest,
        range: [edgeIndex(edges, left), edgeIndex(edges, right)],
      };
      setPosition((previous) => (samePosition(previous, next) ? previous : next));
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(read);
    };
    const remeasure = () => {
      items.current = measureItems(scroller, itemSelector);
      schedule();
    };
    const release = () => {
      target.current = null;
    };
    const settle = () => {
      release();
      schedule();
    };

    const listeners = new AbortController();
    const { signal } = listeners;
    scroller.addEventListener("scroll", schedule, { passive: true, signal });
    scroller.addEventListener("scrollend", settle, { signal });
    for (const type of ["wheel", "pointerdown", "touchstart"] as const) {
      scroller.addEventListener(type, release, { passive: true, signal });
    }
    const resizeObserver = new ResizeObserver(remeasure);
    resizeObserver.observe(scroller);
    const mutationObserver = new MutationObserver(remeasure);
    mutationObserver.observe(scroller, { childList: true, subtree: true });
    remeasure();

    return () => {
      cancelAnimationFrame(frame);
      listeners.abort();
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [scrollerRef, itemSelector]);

  const onValueChange = useCallback(
    (next: number, eventDetails?: SliderPrimitive.Root.ChangeEventDetails) => {
      const scroller = scrollerRef.current;
      const { starts, ends } = items.current;
      if (!scroller || starts.length === 0) return;
      const index = clamp(Math.round(next), 0, starts.length - 1);
      const center = ((starts[index] ?? 0) + (ends[index] ?? 0)) / 2;
      const instant =
        eventDetails?.reason === "drag" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.current = instant ? null : index;
      setPosition((previous) => ({ ...previous, value: index }));
      scroller.scrollTo({
        behavior: instant ? "instant" : "smooth",
        left: center - scroller.clientWidth / 2,
      });
    },
    [scrollerRef],
  );

  return { ...position, onValueChange };
}
