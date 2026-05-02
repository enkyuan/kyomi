import type { InboxTimestampDisplayDto, InboxTimestampHourCycleDto } from "@lib/api-schemas";

const absoluteFormatterCache = new Map<string, Intl.DateTimeFormat>();
const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function getAbsoluteFormatter(hourCycle: InboxTimestampHourCycleDto) {
  const key = hourCycle;
  const cached = absoluteFormatterCache.get(key);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: hourCycle === "12h",
  });
  absoluteFormatterCache.set(key, formatter);
  return formatter;
}

function formatRelative(date: Date) {
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);
  const absMinutes = Math.abs(diffMinutes);

  if (absMinutes < 60) {
    return relativeFormatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  const absHours = Math.abs(diffHours);
  if (absHours < 24) {
    return relativeFormatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  const absDays = Math.abs(diffDays);
  if (absDays < 7) {
    return relativeFormatter.format(diffDays, "day");
  }

  const diffWeeks = Math.round(diffDays / 7);
  if (Math.abs(diffWeeks) < 5) {
    return relativeFormatter.format(diffWeeks, "week");
  }

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return relativeFormatter.format(diffMonths, "month");
  }

  const diffYears = Math.round(diffDays / 365);
  return relativeFormatter.format(diffYears, "year");
}

export function formatInboxTimestamp(
  value: string,
  display: InboxTimestampDisplayDto,
  hourCycle: InboxTimestampHourCycleDto,
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  if (display === "relative") {
    return formatRelative(date);
  }

  return getAbsoluteFormatter(hourCycle).format(date);
}
