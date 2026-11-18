/**
 * Own-key helpers for update bodies. A key present with `null` clears a column and an absent key
 * leaves it alone, so "was this field sent" is `Object.hasOwn`, never a truthiness check.
 */

export function hasAnyOwn(body: object, keys: readonly string[]): boolean {
  return keys.some((key) => Object.hasOwn(body, key));
}

/** Copies the listed keys that `raw` actually carries; the body was validated at the route. */
export function pickOwn<T extends object>(
  raw: Record<string, unknown>,
  keys: readonly (keyof T & string)[],
): T {
  const picked: Record<string, unknown> = {};
  for (const key of keys) {
    if (Object.hasOwn(raw, key)) {
      picked[key] = raw[key];
    }
  }
  return picked as T;
}

/**
 * The `savedAt` after an update: untouched when the save flag was not sent, kept (or set now) when
 * saving, cleared when unsaving. Saving an already saved article keeps its original time.
 */
export function savedAtAfter(
  previous: Date | null,
  isSaved: boolean | undefined,
  now: Date,
): Date | null {
  if (isSaved === undefined) {
    return previous;
  }
  return isSaved ? (previous ?? now) : null;
}
