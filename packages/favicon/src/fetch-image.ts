import { ALLOWED_SCHEMES, assertSafeFaviconHost } from "./host-safety";

const FETCH_OPTIONS = {
  headers: {
    Accept: "image/*,*/*",
    "User-Agent": "Mozilla/5.0 (compatible; CronosFeedFavicon/1.0; +https://cronos.local/favicon)",
  },
  redirect: "follow" as const,
};

/**
 * Fetch a URL and return the response only if it looks like a valid image.
 * Caller must ensure the URL is safe to request (e.g. built from a validated origin).
 */
export async function tryFetchImage(url: string): Promise<Response | null> {
  try {
    const response = await fetch(url, {
      ...FETCH_OPTIONS,
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) {
      void response.body?.cancel();
      return null;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/") && !contentType.includes("icon")) {
      void response.body?.cancel();
      return null;
    }
    return response;
  } catch {
    return null;
  }
}

/** Like `tryFetchImage`, but validates scheme and resolves DNS for SSRF safety first. */
export async function tryFetchImageIfHostSafe(imageUrl: string): Promise<Response | null> {
  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return null;
  }
  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    return null;
  }
  const safe = await assertSafeFaviconHost(parsed.hostname);
  if (!safe) {
    return null;
  }
  return tryFetchImage(imageUrl);
}
