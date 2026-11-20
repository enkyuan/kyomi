/** Page size bounds shared by every list and merged view. */
export function clampLimit(limit: number): number {
  return Math.min(Math.max(limit, 1), 200);
}

/** Articles are never listed from the future: an upper bound later than `now` is capped to `now`. */
export function capPublishedBeforeAtNow(publishedBefore: Date | undefined, now: Date): Date {
  if (!publishedBefore || publishedBefore.getTime() > now.getTime()) {
    return now;
  }
  return publishedBefore;
}

/** `[start, end)` of the UTC day containing `now`. */
export function utcDayRange(now: Date): { start: Date; end: Date } {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}
