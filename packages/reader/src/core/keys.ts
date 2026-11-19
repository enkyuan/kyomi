export type Keyed<T> = { readonly key: string; readonly item: T; readonly position: number };

const fingerprints = new WeakMap<object, string>();

/** Short FNV-1a hash of the item's serialized content; cached per object. */
function fingerprint(item: unknown): string {
  if (typeof item === "object" && item !== null) {
    const cached = fingerprints.get(item);
    if (cached) return cached;
  }
  const text = typeof item === "string" ? item : (JSON.stringify(item) ?? "");
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  }
  const result = hash.toString(36);
  if (typeof item === "object" && item !== null) fingerprints.set(item, result);
  return result;
}

/**
 * Stable keys for positional content that carries no ids: a content fingerprint plus an
 * occurrence counter so identical siblings stay distinct. `position` is the original index.
 */
export function keyedByContent<T>(items: readonly T[]): Keyed<T>[] {
  const seen = new Map<string, number>();
  return items.map((item, position) => {
    const base = fingerprint(item);
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    return { key: `${base}.${occurrence}`, item, position };
  });
}
