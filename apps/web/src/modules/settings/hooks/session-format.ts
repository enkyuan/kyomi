import type { FormattedTimestamp } from "./session-types";

const accountTimestampFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});
const accountRelativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function normalizeTimestamp(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

export function formatRelativeTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);
  const absMinutes = Math.abs(diffMinutes);

  if (absMinutes < 1) {
    return "just now";
  }

  if (absMinutes < 60) {
    return accountRelativeFormatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  const absHours = Math.abs(diffHours);
  if (absHours < 24) {
    return accountRelativeFormatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  const absDays = Math.abs(diffDays);
  if (absDays < 7) {
    return accountRelativeFormatter.format(diffDays, "day");
  }

  const diffWeeks = Math.round(diffDays / 7);
  if (Math.abs(diffWeeks) < 5) {
    return accountRelativeFormatter.format(diffWeeks, "week");
  }

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return accountRelativeFormatter.format(diffMonths, "month");
  }

  const diffYears = Math.round(diffDays / 365);
  return accountRelativeFormatter.format(diffYears, "year");
}

export function formatTimestamp(value: string): FormattedTimestamp {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { absolute: "Unknown", relative: "Unknown" };
  }

  return {
    absolute: accountTimestampFormatter.format(date),
    relative: formatRelativeTimestamp(value),
  };
}
