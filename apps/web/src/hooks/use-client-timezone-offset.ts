"use client";

import { useSyncExternalStore } from "react";

function subscribeToTimezoneOffsetChanges(onStoreChange: () => void) {
  const intervalId = window.setInterval(onStoreChange, 60_000);

  return () => {
    window.clearInterval(intervalId);
  };
}

function getClientTimezoneOffsetMinutes() {
  return new Date().getTimezoneOffset();
}

function getServerTimezoneOffsetMinutes() {
  return undefined;
}

/** Browser timezone offset; undefined until after mount so SSR and hydration agree. */
export function useClientTimezoneOffsetMinutes() {
  return useSyncExternalStore(
    subscribeToTimezoneOffsetChanges,
    getClientTimezoneOffsetMinutes,
    getServerTimezoneOffsetMinutes,
  );
}
