export function capPublishedBeforeAtNow(
  publishedBefore: Date | undefined,
  now: Date = new Date(),
): Date {
  if (!publishedBefore || publishedBefore.getTime() > now.getTime()) {
    return now;
  }
  return publishedBefore;
}
