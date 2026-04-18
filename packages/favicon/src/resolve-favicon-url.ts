import { assertSafeFaviconHost, ALLOWED_SCHEMES } from "./host-safety";

const FETCH_OPTIONS = {
  headers: { Accept: "image/*,*/*" },
  redirect: "follow" as const,
};

/** Try fetching a URL and return the response only if it looks like a valid image. */
export async function tryFetchImage(imageUrl: string): Promise<Response | null> {
  try {
    const response = await fetch(imageUrl, {
      ...FETCH_OPTIONS,
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) {
      response.body?.cancel().catch(() => {});
      return null;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/") && !contentType.includes("icon")) {
      response.body?.cancel().catch(() => {});
      return null;
    }
    return response;
  } catch {
    return null;
  }
}

export async function tryFetchImageIfHostSafe(imageUrl: string): Promise<Response | null> {
  let hostname: string;
  try {
    const parsed = new URL(imageUrl);
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
      return null;
    }
    hostname = parsed.hostname;
  } catch {
    return null;
  }

  const isSafe = await assertSafeFaviconHost(hostname);
  if (!isSafe) {
    return null;
  }

  return tryFetchImage(imageUrl);
}

/** Parse homepage HTML to find a <link rel="icon"> href. */
export async function findIconFromHtml(origin: string): Promise<string | null> {
  try {
    const response = await fetch(origin, {
      headers: { Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return null;
    const reader = response.body?.getReader();
    if (!reader) return null;
    let html = "";
    while (html.length < 16_384) {
      const { value, done } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
    }
    reader.cancel().catch(() => {});

    const links = html.match(/<link[^>]*>/gi) ?? [];
    const match = links.find((linkTag) => /\brel=["'][^"']*\bicon\b[^"']*["']/i.test(linkTag));
    if (!match) return null;
    const hrefMatch = match.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch?.[1]) return null;

    try {
      return new URL(hrefMatch[1], origin).href;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

export type FaviconResolutionSource = "favicon_ico" | "html_link" | "google_s2" | "duckduckgo";

export type ResolveFeedFaviconUrlResult = {
  url: string;
  source: FaviconResolutionSource;
};

/**
 * Resolve a usable favicon image URL for a site/feed URL (http/https only).
 * Validates the seed host and each fetch target with DNS + private-range checks.
 * Returns null if nothing could be resolved safely.
 */
export async function resolveFeedFaviconUrl(
  seedUrl: string,
): Promise<ResolveFeedFaviconUrlResult | null> {
  let origin: string;
  let hostname: string;
  try {
    const parsed = new URL(seedUrl.trim());
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
      return null;
    }
    origin = parsed.origin;
    hostname = parsed.hostname;
  } catch {
    return null;
  }

  const isSafe = await assertSafeFaviconHost(hostname);
  if (!isSafe) {
    return null;
  }

  const directResult = await tryFetchImage(`${origin}/favicon.ico`);
  if (directResult) {
    directResult.body?.cancel().catch(() => {});
    return { url: `${origin}/favicon.ico`, source: "favicon_ico" };
  }

  const iconHref = await findIconFromHtml(origin);
  if (iconHref) {
    const htmlIconResult = await tryFetchImageIfHostSafe(iconHref);
    if (htmlIconResult) {
      htmlIconResult.body?.cancel().catch(() => {});
      return { url: iconHref, source: "html_link" };
    }
  }

  const googleUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`;
  const googleResult = await tryFetchImage(googleUrl);
  if (googleResult) {
    googleResult.body?.cancel().catch(() => {});
    return { url: googleUrl, source: "google_s2" };
  }

  const duckUrl = `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
  const duckDuckGoResult = await tryFetchImage(duckUrl);
  if (duckDuckGoResult) {
    duckDuckGoResult.body?.cancel().catch(() => {});
    return { url: duckUrl, source: "duckduckgo" };
  }

  return null;
}
