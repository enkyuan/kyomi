const TRACKING_PARAMS = new Set(["fbclid", "gclid", "mc_cid"]);

export function normalizeArticleUrl(url: string): string {
  const trimmed = url.trim();

  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();

    for (const key of [...parsed.searchParams.keys()]) {
      if (/^utm_/i.test(key) || TRACKING_PARAMS.has(key)) {
        parsed.searchParams.delete(key);
      }
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
