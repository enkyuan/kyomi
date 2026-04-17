"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

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

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    let rafId: number | null = null;
    const scheduleUpdate = () => {
      if (rafId !== null) {
        return;
      }
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        updateRef.current();
      });
    };

    scheduleUpdate();

    const observer = new ResizeObserver(() => {
      scheduleUpdate();
    });

    observer.observe(viewport);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      observer.disconnect();
    };
  }, [viewportRef]);

  useEffect(() => {
    updateRef.current();
  }, dependencies);

  return metrics;
}
