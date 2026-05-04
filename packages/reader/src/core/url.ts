export function normalizeSafeHttpUrl(raw: string, baseUrl?: string | null): string | null {
  const candidate = raw.trim();
  if (!candidate) {
    return null;
  }
  try {
    const parsed = new URL(candidate, baseUrl ?? undefined);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

export function getReaderSourceLabel(articleUrl: string, fallback: string) {
  try {
    const hostname = new URL(articleUrl).hostname.replace(/^www\./i, "");
    if (!hostname || hostname === "news.ycombinator.com") {
      return fallback;
    }
    return hostname;
  } catch {
    return fallback;
  }
}
