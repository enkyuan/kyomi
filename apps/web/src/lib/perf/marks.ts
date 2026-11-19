const PREFIX = "kyomi:";

/**
 * A named point on the page's timeline. The marks show up in DevTools' Performance panel (Timings
 * track) and are sent with the page's performance report. A no-op on the server.
 */
export function mark(name: string) {
  if (typeof performance === "undefined") {
    return;
  }
  try {
    performance.mark(`${PREFIX}${name}`);
  } catch {
    // User Timing can be unavailable or throttled in constrained contexts.
  }
}

/** Milliseconds since navigation start at which each `kyomi:` mark was first recorded. */
export function readMarks(): Record<string, number> {
  const marks: Record<string, number> = {};
  if (typeof performance === "undefined") {
    return marks;
  }
  for (const entry of performance.getEntriesByType("mark")) {
    if (entry.name.startsWith(PREFIX)) {
      marks[entry.name.slice(PREFIX.length)] ??= Math.round(entry.startTime);
    }
  }
  return marks;
}
