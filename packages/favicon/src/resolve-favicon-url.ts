import { assertSafeFaviconHost, ALLOWED_SCHEMES } from "./host-safety";

const MAX_REDIRECT_HOPS = 5;

/**
 * Follows redirects manually, re-validating each Location URL's hostname with
 * assertSafeFaviconHost when `validateEachHop` is true. This prevents SSRF via
 * open-redirect chains that could reach private/internal addresses.
 */
async function fetchWithRedirectGuard(
  startUrl: string,
  init: Omit<RequestInit, "redirect"> & { signal?: AbortSignal },
  validateEachHop: boolean,
): Promise<Response | null> {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
      return null;
    }
    if (validateEachHop) {
      const isSafe = await assertSafeFaviconHost(parsed.hostname);
      if (!isSafe) {
        return null;
      }
    }

    let response: Response;
    try {
      response = await fetch(url, { ...init, redirect: "manual" });
    } catch {
      return null;
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      response.body?.cancel().catch(() => {});
      if (!location) {
        return null;
      }
      try {
        url = new URL(location, url).href;
      } catch {
        return null;
      }
      continue;
    }

    return response;
  }

  // Exceeded maximum redirect hops.
  return null;
}

/** Validates that a Response is an HTTP 200 OK with an image content-type. */
function isImageResponse(response: Response): boolean {
  if (!response.ok) return false;
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.startsWith("image/") || contentType.includes("icon");
}

/** Try fetching a URL and return the response only if it looks like a valid image. */
export async function tryFetchImage(imageUrl: string): Promise<Response | null> {
  const response = await fetchWithRedirectGuard(
    imageUrl,
    { headers: { Accept: "image/*,*/*" }, signal: AbortSignal.timeout(2500) },
    false,
  );
  if (!response || !isImageResponse(response)) {
    response?.body?.cancel().catch(() => {});
    return null;
  }
  return response;
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

  // Use redirect guard with per-hop host validation so a redirect chain cannot
  // bypass the SSRF guard by pointing to a private/internal address.
  const response = await fetchWithRedirectGuard(
    imageUrl,
    { headers: { Accept: "image/*,*/*" }, signal: AbortSignal.timeout(2500) },
    true,
  );
  if (!response || !isImageResponse(response)) {
    response?.body?.cancel().catch(() => {});
    return null;
  }
  return response;
}

/** Parse homepage HTML to find a <link rel="icon"> href. */
export async function findIconFromHtml(origin: string): Promise<string | null> {
  try {
    const response = await fetchWithRedirectGuard(
      origin,
      { headers: { Accept: "text/html" }, signal: AbortSignal.timeout(2500) },
      true,
    );
    if (!response?.ok) return null;
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
