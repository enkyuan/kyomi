"use client";

import { useEffect, useRef, type RefObject } from "react";

/** A row counts as seen once at least this much of it is visible... */
const IMPRESSION_MIN_VISIBLE_RATIO = 0.5;
/** ...for this long. */
const IMPRESSION_DWELL_MS = 1_000;
/** Impressions that land close together go out as one request. */
const IMPRESSION_BATCH_DELAY_MS = 500;
/** The endpoint accepts 1..20 ids per request. */
const IMPRESSION_MAX_BATCH = 20;

export const IMPRESSION_ID_ATTRIBUTE = "data-impression-id";

/** Ids already reported in this page view; a row is reported at most once. */
const reportedIds = new Set<string>();

export function resetReportedImpressions() {
  reportedIds.clear();
}

/**
 * Reports each marked row inside `containerRef` once it has been at least 50% visible for 1 s.
 * Mark rows with `data-impression-id`. `watchKey` changes when the rendered rows change.
 */
export function useImpressions({
  containerRef,
  watchKey,
  onReport,
}: {
  containerRef: RefObject<HTMLElement | null>;
  watchKey: string;
  onReport: (articleIds: string[]) => void;
}) {
  const onReportRef = useRef(onReport);

  useEffect(() => {
    onReportRef.current = onReport;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === "undefined") {
      return;
    }

    const dwellTimers = new Map<string, ReturnType<typeof setTimeout>>();
    let pending: string[] = [];
    let batchTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      if (batchTimer !== null) {
        clearTimeout(batchTimer);
        batchTimer = null;
      }
      while (pending.length > 0) {
        onReportRef.current(pending.slice(0, IMPRESSION_MAX_BATCH));
        pending = pending.slice(IMPRESSION_MAX_BATCH);
      }
    };

    const queue = (id: string) => {
      if (reportedIds.has(id)) {
        return;
      }
      reportedIds.add(id);
      pending.push(id);
      if (batchTimer === null) {
        batchTimer = setTimeout(flush, IMPRESSION_BATCH_DELAY_MS);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute(IMPRESSION_ID_ATTRIBUTE);
          if (!id || reportedIds.has(id)) {
            continue;
          }
          const visible =
            entry.isIntersecting && entry.intersectionRatio >= IMPRESSION_MIN_VISIBLE_RATIO;
          const timer = dwellTimers.get(id);
          if (visible && timer === undefined) {
            dwellTimers.set(
              id,
              setTimeout(() => {
                dwellTimers.delete(id);
                queue(id);
              }, IMPRESSION_DWELL_MS),
            );
          } else if (!visible && timer !== undefined) {
            clearTimeout(timer);
            dwellTimers.delete(id);
          }
        }
      },
      { threshold: [0, IMPRESSION_MIN_VISIBLE_RATIO, 1] },
    );

    for (const element of container.querySelectorAll(`[${IMPRESSION_ID_ATTRIBUTE}]`)) {
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
      for (const timer of dwellTimers.values()) {
        clearTimeout(timer);
      }
      flush();
    };
  }, [containerRef, watchKey]);
}
