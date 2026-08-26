function formatCompactRelative(value: number, unit: "s" | "m" | "h" | "d" | "w" | "mo" | "y") {
  return `${Math.abs(value)}${unit}`;
}

function formatRelative(date: Date) {
  const diffMs = date.getTime() - Date.now();
  const diffSeconds = Math.round(diffMs / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 60) return formatCompactRelative(diffSeconds, "s");

  const diffMinutes = Math.round(diffMs / 60_000);
  const absMinutes = Math.abs(diffMinutes);
  if (absMinutes < 60) return formatCompactRelative(diffMinutes, "m");

  const diffHours = Math.round(diffMinutes / 60);
  const absHours = Math.abs(diffHours);
  if (absHours < 24) return formatCompactRelative(diffHours, "h");

  const diffDays = Math.round(diffHours / 24);
  const absDays = Math.abs(diffDays);
  if (absDays < 7) return formatCompactRelative(diffDays, "d");

  const diffWeeks = Math.round(diffDays / 7);
  if (Math.abs(diffWeeks) < 5) return formatCompactRelative(diffWeeks, "w");

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) return formatCompactRelative(diffMonths, "mo");

  const diffYears = Math.round(diffDays / 365);
  return formatCompactRelative(diffYears, "y");
}

export function formatInboxTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatRelative(date);
}
