"use client";

import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

type ViewportMetrics = {
  viewportHeight: number;
  containerWidth: number;
  hasVerticalOverflow: boolean;
};

export function useViewportMetrics(
  viewportRef: RefObject<HTMLElement | null>,
  dependencies: unknown[] = [],
) {
  const [metrics, setMetrics] = useState<ViewportMetrics>({
    viewportHeight: 0,
    containerWidth: 0,
    hasVerticalOverflow: false,
  });
  const updateRef = useRef<() => void>(() => {});
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    updateRef.current = () => {
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }

      const nextMetrics: ViewportMetrics = {
        viewportHeight: viewport.clientHeight,
        containerWidth: viewport.clientWidth,
        hasVerticalOverflow: viewport.scrollHeight - viewport.clientHeight > 1,
      };

      setMetrics((prev) =>
        prev.viewportHeight === nextMetrics.viewportHeight &&
        prev.containerWidth === nextMetrics.containerWidth &&
        prev.hasVerticalOverflow === nextMetrics.hasVerticalOverflow
          ? prev
          : nextMetrics,
      );
    };
  }, [viewportRef]);

  const scheduleUpdate = useCallback(() => {
    if (rafIdRef.current !== null) {
      return;
    }
    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null;
      updateRef.current();
    });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    scheduleUpdate();

    const observer = new ResizeObserver(() => {
      scheduleUpdate();
    });

    observer.observe(viewport);

    return () => {
      const rafId = rafIdRef.current;
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafIdRef.current = null;
      }
      observer.disconnect();
    };
  }, [viewportRef, scheduleUpdate]);

  useEffect(() => {
    scheduleUpdate();
  }, [scheduleUpdate, ...dependencies]);

  return metrics;
}
