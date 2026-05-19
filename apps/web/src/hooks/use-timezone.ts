"use client";

import { useSyncExternalStore } from "react";

function subscribeToTimezoneChanges(onStoreChange: () => void) {
  const intervalId = window.setInterval(onStoreChange, 60_000);

  return () => {
    window.clearInterval(intervalId);
  };
}

function getTimezoneOffsetMinutes() {
  return new Date().getTimezoneOffset();
}

function getServerTimezoneOffsetMinutes() {
  return undefined;
}

/** Client timezone offset in minutes; `undefined` until after mount so SSR and hydration agree. */
export function useTimezone() {
  return useSyncExternalStore(
    subscribeToTimezoneChanges,
    getTimezoneOffsetMinutes,
    getServerTimezoneOffsetMinutes,
  );
}
