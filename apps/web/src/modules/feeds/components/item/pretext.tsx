"use client";

import { layout, prepare } from "@chenglou/pretext";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { cn } from "@lib/utils";

const PRETEXT_MIN_FILL_RATIO = 0.97;
const PRETEXT_MAX_TRIM = 8;
const PRETEXT_WIDTH_BUFFER = 4;
const PRETEXT_CACHE_LIMIT = 600;
const pretextPrepareCache = new Map<string, ReturnType<typeof prepare>>();
const pretextFitCache = new Map<string, number | undefined>();

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

function getPreparedText(text: string, font: string) {
  const key = `${font}\n${text}`;
  return (
    pretextPrepareCache.get(key) ??
    rememberCacheValue(pretextPrepareCache, key, prepare(text, font))
  );
}

function getFittedPretextWidth({
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
  const cached = pretextFitCache.get(key);
  if (cached !== undefined || pretextFitCache.has(key)) {
    return cached;
  }

  const prepared = getPreparedText(text, font);
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
    pretextFitCache,
    key,
    Math.min(roundedWidth, best + PRETEXT_WIDTH_BUFFER),
  );
}

type PretextProps = {
  text: string;
  font: string;
  lineHeight: number;
  maxLines: number;
  className?: string;
  containerWidth?: number;
  style?: CSSProperties;
};

function arePretextPropsEqual(prev: PretextProps, next: PretextProps) {
  return (
    prev.text === next.text &&
    prev.font === next.font &&
    prev.lineHeight === next.lineHeight &&
    prev.maxLines === next.maxLines &&
    prev.className === next.className &&
    prev.containerWidth === next.containerWidth &&
    prev.style?.fontSize === next.style?.fontSize &&
    prev.style?.lineHeight === next.style?.lineHeight
  );
}

export const Pretext = memo(function Pretext({
  text,
  font,
  lineHeight,
  maxLines,
  className,
  containerWidth,
  style,
}: PretextProps) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const [parentWidth, setParentWidth] = useState<number | null>(null);

  useEffect(() => {
    if (containerWidth !== undefined) {
      return;
    }

    const element = ref.current;
    const parent = element?.parentElement;
    if (!element || !parent) {
      return;
    }

    const updateWidth = () => {
      setParentWidth(parent.clientWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(parent);
    return () => observer.disconnect();
  }, [containerWidth]);

  const maxWidth = containerWidth ?? parentWidth;

  const fittedWidth = useMemo(() => {
    if (!maxWidth || maxWidth <= 0) {
      return undefined;
    }
    return getFittedPretextWidth({ text, font, lineHeight, maxLines, maxWidth });
  }, [font, lineHeight, maxLines, maxWidth, text]);

  return (
    <p
      ref={ref}
      className={cn("w-full", className)}
      style={{
        maxWidth: fittedWidth ? `${fittedWidth}px` : undefined,
        ...style,
      }}
    >
      {text}
    </p>
  );
}, arePretextPropsEqual);
