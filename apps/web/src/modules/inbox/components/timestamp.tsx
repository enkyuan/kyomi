"use client";

import type { InboxTimestampDisplayDto, InboxTimestampHourCycleDto } from "@lib/schemas/index";
import { useHydrated } from "@hooks/use-hydrated";
import {
  formatInboxTimestamp,
  formatInboxTimestampSsrFallback,
} from "@modules/inbox/utils/format-timestamp";

type TimestampProps = {
  value: string;
  display: InboxTimestampDisplayDto;
  hourCycle: InboxTimestampHourCycleDto;
};

export function Timestamp({ value, display, hourCycle }: TimestampProps) {
  const hydrated = useHydrated();
  const formattedValue = hydrated
    ? formatInboxTimestamp(value, display, hourCycle)
    : formatInboxTimestampSsrFallback(value, display, hourCycle);

  return (
    <time dateTime={value} suppressHydrationWarning>
      {formattedValue}
    </time>
  );
}
