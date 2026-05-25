"use client";

import { useSyncExternalStore } from "react";
import type { InboxTimestampDisplayDto, InboxTimestampHourCycleDto } from "@lib/schemas";
import {
  formatInboxTimestamp,
  formatInboxTimestampSsrFallback,
} from "@modules/inbox/utils/format-timestamp";

function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

type TimestampTextProps = {
  value: string;
  display: InboxTimestampDisplayDto;
  hourCycle: InboxTimestampHourCycleDto;
};

export function TimestampText({ value, display, hourCycle }: TimestampTextProps) {
  const hydrated = useHydrated();
  const formattedValue = hydrated
    ? formatInboxTimestamp(value, display, hourCycle)
    : formatInboxTimestampSsrFallback(value, hourCycle);

  return <time dateTime={value}>{formattedValue}</time>;
}
