export function normalizeHttpUrlComparable(value: string | null): string | null {
  if (!value) {
    return null;
  }
  try {
    const u = new URL(value);
    u.hash = "";
    return u.href;
  } catch {
    return value;
  }
}

/** Prefer site link; fall back to feed URL for origin-based favicon resolution. */
export function pickHttpUrlForFaviconResolution(
  link: string | null,
  feedUrl: string,
): string | null {
  const primary = link?.trim();
  if (primary) {
    try {
      const u = new URL(primary);
      if (u.protocol === "http:" || u.protocol === "https:") {
        return primary;
      }
    } catch {
      /* fall through */
    }
  }
  try {
    const u = new URL(feedUrl.trim());
    if (u.protocol === "http:" || u.protocol === "https:") {
      return u.href;
    }
  } catch {
    return null;
  }
  return null;
}
