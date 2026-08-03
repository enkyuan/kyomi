"use client";

import { useSyncExternalStore } from "react";

let timestampTick = 0;
let timestampIntervalId: ReturnType<typeof setInterval> | null = null;
const timestampListeners = new Set<() => void>();

function emitTimestampTick() {
  timestampTick += 1;
  for (const listener of timestampListeners) {
    listener();
  }
}

function subscribeToTimestampTick(listener: () => void) {
  timestampListeners.add(listener);

  if (timestampIntervalId === null) {
    timestampIntervalId = setInterval(emitTimestampTick, 60_000);
  }

  return () => {
    timestampListeners.delete(listener);
    if (timestampListeners.size === 0 && timestampIntervalId !== null) {
      clearInterval(timestampIntervalId);
      timestampIntervalId = null;
    }
  };
}

function getTimestampSnapshot() {
  return timestampTick;
}

/**
 * Subscribes to a shared minute ticker when timestamps render in relative mode,
 * so list rows and detail surfaces stay in sync without per-item intervals.
 */
export function useTimestamp(display: "absolute" | "relative") {
  useSyncExternalStore(
    display === "relative" ? subscribeToTimestampTick : () => () => {},
    getTimestampSnapshot,
    () => 0,
  );
}
