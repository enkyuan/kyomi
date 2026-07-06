"use client";

import { useEffect, useSyncExternalStore } from "react";
import { writeTimezoneOffsetCookie } from "@lib/timezone";

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
  const timezoneOffsetMinutes = useSyncExternalStore(
    subscribeToTimezoneChanges,
    getTimezoneOffsetMinutes,
    getServerTimezoneOffsetMinutes,
  );

  useEffect(() => {
    if (typeof timezoneOffsetMinutes === "number") {
      writeTimezoneOffsetCookie(timezoneOffsetMinutes);
    }
  }, [timezoneOffsetMinutes]);

  return timezoneOffsetMinutes;
}
