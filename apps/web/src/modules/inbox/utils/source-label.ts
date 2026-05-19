export function getFeedSourceLabel(articleUrl: string, fallback: string) {
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
