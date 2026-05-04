"use client";

import { useSyncExternalStore } from "react";
import type { InboxTimestampDisplayDto } from "@lib/api-schemas";

let relativeTimestampTick = 0;
let relativeTimestampIntervalId: ReturnType<typeof setInterval> | null = null;
const relativeTimestampListeners = new Set<() => void>();

function emitRelativeTimestampTick() {
  relativeTimestampTick += 1;
  for (const listener of relativeTimestampListeners) {
    listener();
  }
}

function subscribeToRelativeTimestampTick(listener: () => void) {
  relativeTimestampListeners.add(listener);

  if (relativeTimestampIntervalId === null) {
    relativeTimestampIntervalId = setInterval(emitRelativeTimestampTick, 60_000);
  }

  return () => {
    relativeTimestampListeners.delete(listener);
    if (relativeTimestampListeners.size === 0 && relativeTimestampIntervalId !== null) {
      clearInterval(relativeTimestampIntervalId);
      relativeTimestampIntervalId = null;
    }
  };
}

function getRelativeTimestampSnapshot() {
  return relativeTimestampTick;
}

/**
 * Keeps relative timestamps fresh with one shared minute ticker for the whole app
 * instead of one interval per rendered row/detail surface.
 */
export function useRelativeTimestampRefresh(display: InboxTimestampDisplayDto) {
  useSyncExternalStore(
    display === "relative" ? subscribeToRelativeTimestampTick : () => () => {},
    getRelativeTimestampSnapshot,
    () => 0,
  );
}
