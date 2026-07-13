"use client";

import { layout, prepare } from "@chenglou/pretext";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";

const PRETEXT_MIN_FILL_RATIO = 0.97;
const PRETEXT_MAX_TRIM = 8;
const PRETEXT_WIDTH_BUFFER = 4;
const PRETEXT_CACHE_LIMIT = 600;

const prepareCache = new Map<string, ReturnType<typeof prepare>>();
const fitWidthCache = new Map<string, number | undefined>();

function rememberCacheValue<T>(cache: Map<string, T>, key: string, value: T) {
  if (cache.size >= PRETEXT_CACHE_LIMIT) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) {
      cache.delete(firstKey);
    }
  }
  cache.set(key, value);
  return value;
}

function preparePretextText(text: string, font: string) {
  if (typeof window === "undefined" || typeof CanvasRenderingContext2D === "undefined") {
    return null;
  }
  const key = `${font}\n${text}`;
  return prepareCache.get(key) ?? rememberCacheValue(prepareCache, key, prepare(text, font));
}

function fitPretextLabelToSingleLine(
  label: string,
  font: string,
  availableWidth: number,
  lineHeight: number,
  preparedLabel: ReturnType<typeof prepare> | null,
): string {
  if (!preparedLabel || availableWidth <= 0) {
    return label;
  }
  if (layout(preparedLabel, availableWidth, lineHeight).lineCount <= 1) {
    return label;
  }

  let low = 0;
  let high = label.length;
  let best = "…";

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = `${label.slice(0, mid).trimEnd()}…`;
    const preparedCandidate = preparePretextText(candidate, font);

    if (preparedCandidate && layout(preparedCandidate, availableWidth, lineHeight).lineCount <= 1) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

function fitPretextContentWidth({
  text,
  font,
  lineHeight,
  maxLines,
  maxWidth,
}: {
  text: string;
  font: string;
  lineHeight: number;
  maxLines: number;
  maxWidth: number;
}) {
  const roundedWidth = Math.round(maxWidth);
  const key = `${font}\n${lineHeight}\n${maxLines}\n${roundedWidth}\n${text}`;
  const cached = fitWidthCache.get(key);
  if (cached !== undefined || fitWidthCache.has(key)) {
    return cached;
  }

  const prepared = preparePretextText(text, font);
  if (!prepared) {
    return undefined;
  }

  let low = Math.max(
    120,
    Math.ceil(Math.max(roundedWidth * PRETEXT_MIN_FILL_RATIO, roundedWidth - PRETEXT_MAX_TRIM)),
  );
  let high = roundedWidth;
  let best = roundedWidth;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const { lineCount } = layout(prepared, mid, lineHeight);
    if (lineCount <= maxLines) {
      best = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return rememberCacheValue(
    fitWidthCache,
    key,
    Math.min(roundedWidth, best + PRETEXT_WIDTH_BUFFER),
  );
}

function useObservedElementWidth(
  ref: RefObject<HTMLElement | null>,
  {
    observeParent = false,
    disabled = false,
  }: {
    observeParent?: boolean;
    disabled?: boolean;
  } = {},
) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (disabled) {
      return;
    }

    const element = observeParent ? ref.current?.parentElement : ref.current;
    if (!element) {
      return;
    }

    const updateWidth = () => {
      setWidth(element.clientWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [disabled, observeParent, ref]);

  return width;
}

/** Truncate a single-line label to fit its container width (sidebar workspace title). */
export function usePretext({
  label,
  font,
  lineHeight,
}: {
  label: string;
  font: string;
  lineHeight: number;
}) {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const preparedLabel = useMemo(() => preparePretextText(label, font), [font, label]);
  const availableWidth = useObservedElementWidth(containerRef);

  const fittedLabel = useMemo(
    () => fitPretextLabelToSingleLine(label, font, availableWidth, lineHeight, preparedLabel),
    [availableWidth, font, label, lineHeight, preparedLabel],
  );

  return {
    containerRef,
    fittedLabel,
  };
}

/** Fit block text to a max line count by constraining rendered width (inbox feed cards). */
export function usePretextLayout({
  text,
  font,
  lineHeight,
  maxLines,
  containerWidth,
}: {
  text: string;
  font: string;
  lineHeight: number;
  maxLines: number;
  containerWidth?: number;
}) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const observedWidth = useObservedElementWidth(ref, {
    observeParent: true,
    disabled: containerWidth !== undefined,
  });
  const maxWidth = containerWidth ?? observedWidth;

  const fittedWidth = useMemo(() => {
    if (!maxWidth || maxWidth <= 0) {
      return undefined;
    }
    return fitPretextContentWidth({ text, font, lineHeight, maxLines, maxWidth });
  }, [font, lineHeight, maxLines, maxWidth, text]);

  return {
    ref,
    fittedWidth,
    maxWidth,
  };
}
