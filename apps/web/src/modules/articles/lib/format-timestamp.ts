import type { InboxTimestampDisplayDto, InboxTimestampHourCycleDto } from "@kyomi/reader/schemas";

const absoluteFormatter12h = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  hour12: true,
});
const absoluteFormatter24h = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  hour12: false,
});
const absoluteUtcFormatter12h = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  hour12: true,
  timeZone: "UTC",
});
const absoluteUtcFormatter24h = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  hour12: false,
  timeZone: "UTC",
});
function formatCompactRelative(value: number, unit: "s" | "m" | "h" | "d" | "w" | "mo" | "y") {
  return `${Math.abs(value)}${unit}`;
}

function getAbsoluteFormatter(hourCycle: InboxTimestampHourCycleDto) {
  return hourCycle === "12h" ? absoluteFormatter12h : absoluteFormatter24h;
}

function getAbsoluteUtcFormatter(hourCycle: InboxTimestampHourCycleDto) {
  return hourCycle === "12h" ? absoluteUtcFormatter12h : absoluteUtcFormatter24h;
}

const relativeLongFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
const dateUtcFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

/** "5 minutes ago", "yesterday", "in 2 hours": the same steps as the compact form, spelled out. */
function formatRelativeLong(date: Date) {
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 3600],
    ["hour", 86_400],
    ["day", 604_800],
    ["week", 2_592_000],
    ["month", 31_536_000],
  ];
  let divisor = 1;
  for (const [unit, limit] of steps) {
    if (abs < limit) {
      return relativeLongFormatter.format(Math.round(diffSeconds / divisor), unit);
    }
    divisor = limit;
  }
  return relativeLongFormatter.format(Math.round(diffSeconds / 31_536_000), "year");
}

/** 2026-11-18 21:41 (or 9:41 PM with a 12-hour clock), in the given time zone. */
function formatIso(date: Date, hourCycle: InboxTimestampHourCycleDto, timeZone?: "UTC") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hour12: hourCycle === "12h",
    minute: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const dayPeriod = get("dayPeriod");
  const hour = hourCycle === "24h" && get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")} ${hour}:${get("minute")}${
    dayPeriod ? ` ${dayPeriod.toUpperCase()}` : ""
  }`;
}

/** Formats that are not the compact relative or the medium date and time. */
function formatOtherDisplay(
  date: Date,
  display: InboxTimestampDisplayDto,
  hourCycle: InboxTimestampHourCycleDto,
  utc: boolean,
) {
  if (display === "relative-long") {
    return formatRelativeLong(date);
  }
  if (display === "date") {
    return (utc ? dateUtcFormatter : dateFormatter).format(date);
  }
  if (display === "iso") {
    return formatIso(date, hourCycle, utc ? "UTC" : undefined);
  }
  return null;
}

function formatRelative(date: Date) {
  const diffMs = date.getTime() - Date.now();
  const diffSeconds = Math.round(diffMs / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 60) {
    return formatCompactRelative(diffSeconds, "s");
  }

  const diffMinutes = Math.round(diffMs / 60_000);
  const absMinutes = Math.abs(diffMinutes);

  if (absMinutes < 60) {
    return formatCompactRelative(diffMinutes, "m");
  }

  const diffHours = Math.round(diffMinutes / 60);
  const absHours = Math.abs(diffHours);
  if (absHours < 24) {
    return formatCompactRelative(diffHours, "h");
  }

  const diffDays = Math.round(diffHours / 24);
  const absDays = Math.abs(diffDays);
  if (absDays < 7) {
    return formatCompactRelative(diffDays, "d");
  }

  const diffWeeks = Math.round(diffDays / 7);
  if (Math.abs(diffWeeks) < 5) {
    return formatCompactRelative(diffWeeks, "w");
  }

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return formatCompactRelative(diffMonths, "mo");
  }

  const diffYears = Math.round(diffDays / 365);
  return formatCompactRelative(diffYears, "y");
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

  return (
    formatOtherDisplay(date, display, hourCycle, false) ??
    getAbsoluteFormatter(hourCycle).format(date)
  );
}

export function formatInboxTimestampSsrFallback(
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

  return (
    formatOtherDisplay(date, display, hourCycle, true) ??
    getAbsoluteUtcFormatter(hourCycle).format(date)
  );
}
