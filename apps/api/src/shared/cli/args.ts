/** The value following `flag`, or null when the flag is absent or followed by another flag. */
export function valueAfter(argv: readonly string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return null;
  }
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

/** A positive integer flag, `fallback` when absent. A malformed value throws rather than falling back. */
export function positiveIntFlag(argv: readonly string[], flag: string, fallback: number): number {
  const value = valueAfter(argv, flag);
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${flag} value: ${value}`);
  }
  return parsed;
}
