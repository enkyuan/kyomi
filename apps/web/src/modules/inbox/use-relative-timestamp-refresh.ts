"use client";

import { useEffect, useState } from "react";
import type { InboxTimestampDisplayDto } from "@lib/api-schemas";

/**
 * Forces a re-render every 60 seconds when `display === "relative"` so that
 * relative timestamps (e.g. "5 minutes ago") don't stay frozen after the
 * initial render.
 */
export function useRelativeTimestampRefresh(display: InboxTimestampDisplayDto) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (display !== "relative") return;
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [display]);
}
