const TRACKING_PARAMS = new Set(["fbclid", "gclid", "mc_cid"]);

const isTrackingParam = (key: string) => /^utm_/i.test(key) || TRACKING_PARAMS.has(key);

export function normalizeArticleUrl(url: string): string {
  const trimmed = url.trim();

  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();

    // The query is rebuilt once, and only when a tracking parameter was dropped: every
    // `searchParams.delete` re-serialises the whole query, which is quadratic in the number of
    // parameters a hostile link can carry, and an untouched query stays byte-identical so the
    // identity derived from it never changes.
    const params = [...parsed.searchParams];
    const kept = params.filter(([key]) => !isTrackingParam(key));
    if (kept.length < params.length) {
      parsed.search = new URLSearchParams(kept).toString();
    }

    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return parsed.href;
  } catch {
    return trimmed;
  }
}

export function buildArticleIdentity(feedId: string, url: string): string {
  return `${feedId}|${normalizeArticleUrl(url)}`;
}
