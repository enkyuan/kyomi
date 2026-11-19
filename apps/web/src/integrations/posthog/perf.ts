import { onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";
import { getHotCacheOutcome } from "@lib/query/cache";
import { readMarks } from "@lib/perf/marks";
import { capturePagePerf } from "./capture";

type PagePerfOptions = {
  /** The id of the route the page is on when it is reported, for example `/_app/inbox/$itemId`. */
  getRouteId: () => string | undefined;
};

let started = false;

function navigationEntry() {
  return performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
}

function serverTimings(entry: PerformanceNavigationTiming | undefined) {
  const timings: Record<string, number> = {};
  for (const timing of entry?.serverTiming ?? []) {
    timings[timing.name] = Math.round(timing.duration);
  }
  return timings;
}

/**
 * Collects the page's Core Web Vitals, the `kyomi:` marks, the server's timing and how the hot cache
 * fared, and sends them as one event when the page is hidden or closed. One event per page
 * lifecycle keeps the volume low; a soft navigation inside the app is part of the same lifecycle.
 */
export function startPagePerfReporting({ getRouteId }: PagePerfOptions) {
  if (started || typeof window === "undefined") {
    return;
  }
  started = true;

  const vitals: Record<string, number> = {};
  const record = (metric: { name: string; value: number }) => {
    vitals[metric.name] =
      metric.name === "CLS" ? Number(metric.value.toFixed(4)) : Math.round(metric.value);
  };
  onTTFB(record);
  onFCP(record);
  onLCP(record);
  onINP(record);
  onCLS(record);

  let reported = false;
  const report = () => {
    if (reported || Object.keys(vitals).length === 0) {
      return;
    }
    reported = true;
    const entry = navigationEntry();
    capturePagePerf({
      route_id: getRouteId(),
      navigation_type: entry?.type,
      hot_cache: getHotCacheOutcome(),
      vitals,
      marks: readMarks(),
      server_timing: serverTimings(entry),
    });
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      report();
    }
  });
  window.addEventListener("pagehide", report);
}
