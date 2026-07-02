"use client";

import type { InboxTimestampDisplayDto, InboxTimestampHourCycleDto } from "@lib/schemas";
import { useHydrated } from "@hooks/use-hydrated";
import {
  formatInboxTimestamp,
  formatInboxTimestampSsrFallback,
} from "@modules/inbox/utils/format-timestamp";

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
