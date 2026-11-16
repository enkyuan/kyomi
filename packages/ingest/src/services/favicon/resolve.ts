import { ALLOWED_SCHEMES, assertSafeFaviconHost } from "./host-safety";

const MAX_REDIRECT_HOPS = 5;
const HTML_ICON_SCAN_MAX_CHARS = 128 * 1024;
const FAVICON_REQUEST_TIMEOUT_MS = 1_200;

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

/**
 * Whether a <link rel="..."> attribute declares a browser-renderable site icon.
 * Uses whitespace tokenization so `mask-icon` does not match, unlike a naive
 * `/\\bicon\\b/` check on the raw string.
 */
export function linkRelDeclaresSiteIcon(rawRel: string): boolean {
  const tokens = rawRel.toLowerCase().split(/\s+/).filter(Boolean);
  return (
    tokens.includes("icon") ||
    tokens.includes("apple-touch-icon") ||
    tokens.includes("apple-touch-icon-precomposed")
  );
}

function extractHtmlAttribute(tag: string, attributeName: string): string | null {
  const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const attributePattern = new RegExp(
    `\\b${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\\x60]+))`,
    "i",
  );
  const match = attributePattern.exec(tag);
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  return value ?? null;
}

function isLikelyBinaryIconUrl(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    const p = pathname.toLowerCase();
    return (
      p.endsWith(".ico") ||
      p.endsWith(".png") ||
      p.endsWith(".jpg") ||
      p.endsWith(".jpeg") ||
      p.endsWith(".gif") ||
      p.endsWith(".webp") ||
      p.endsWith(".avif") ||
      p.includes("favicon")
    );
  } catch {
    return false;
  }
}

/** Validates that a Response is an HTTP 200 OK with a usable favicon payload. */
function isImageResponse(response: Response, requestUrl: string): boolean {
  if (!response.ok) return false;
  const raw = response.headers.get("content-type") ?? "";
  const contentType = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  if (contentType.startsWith("image/")) return true;
  if (raw.toLowerCase().includes("icon")) return true;
  // Many servers still serve favicon.ico as application/octet-stream.
  if (contentType === "application/octet-stream" && isLikelyBinaryIconUrl(requestUrl)) {
    return true;
  }
  return false;
}

/** Try fetching a URL and return the response only if it looks like a valid image. */
export async function tryFetchImage(imageUrl: string): Promise<Response | null> {
  const response = await fetchWithRedirectGuard(
    imageUrl,
    { headers: { Accept: "image/*,*/*" }, signal: AbortSignal.timeout(FAVICON_REQUEST_TIMEOUT_MS) },
    false,
  );
  if (!response || !isImageResponse(response, imageUrl)) {
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
    { headers: { Accept: "image/*,*/*" }, signal: AbortSignal.timeout(FAVICON_REQUEST_TIMEOUT_MS) },
    true,
  );
  if (!response || !isImageResponse(response, imageUrl)) {
    response?.body?.cancel().catch(() => {});
    return null;
  }
  return response;
}

/** Parse homepage HTML to find all <link rel="icon"> href values in order. */
function declaredIconSize(
  rawSizes: string | null,
  iconUrl: string,
  rawType: string | null,
): number {
  const type = rawType?.toLowerCase() ?? "";
  if (type.includes("svg")) {
    return Number.POSITIVE_INFINITY;
  }
  const sizes = rawSizes?.toLowerCase() ?? "";
  if (sizes.includes("any")) {
    return Number.POSITIVE_INFINITY;
  }

  let largest = 0;
  const sizeMatches = sizes.matchAll(/(\d{1,4})\s*x\s*(\d{1,4})/g);
  for (const match of sizeMatches) {
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (Number.isFinite(width) && Number.isFinite(height)) {
      largest = Math.max(largest, Math.min(width, height));
    }
  }
  if (largest > 0) {
    return largest;
  }

  try {
    const pathname = new URL(iconUrl).pathname.toLowerCase();
    if (pathname.endsWith(".svg")) {
      return Number.POSITIVE_INFINITY;
    }
    const pathSizeMatch = /(?:^|[-_/])(\d{2,4})x(\d{2,4})(?:[-_.]|$)/.exec(pathname);
    if (pathSizeMatch) {
      return Math.min(Number(pathSizeMatch[1]), Number(pathSizeMatch[2]));
    }
    if (pathname.includes("apple-touch-icon")) {
      return 180;
    }
    if (pathname.endsWith(".ico")) {
      return 32;
    }
  } catch {
    // Fall through to the default below.
  }

  return 64;
}

function iconCandidateScore({
  rel,
  sizes,
  type,
  url,
}: {
  rel: string;
  sizes: string | null;
  type: string | null;
  url: string;
}): number {
  const declaredSize = declaredIconSize(sizes, url, type);
  if (declaredSize === Number.POSITIVE_INFINITY) {
    return 10_000;
  }
  const relTokens = rel.toLowerCase().split(/\s+/).filter(Boolean);
  const appleTouchBonus =
    relTokens.includes("apple-touch-icon") || relTokens.includes("apple-touch-icon-precomposed")
      ? 256
      : 0;
  return declaredSize + appleTouchBonus;
}

export async function findIconsFromHtml(origin: string): Promise<string[]> {
  try {
    const response = await fetchWithRedirectGuard(
      origin,
      { headers: { Accept: "text/html" }, signal: AbortSignal.timeout(FAVICON_REQUEST_TIMEOUT_MS) },
      true,
    );
    if (!response?.ok) return [];
    const reader = response.body?.getReader();
    if (!reader) return [];
    let html = "";
    while (html.length < HTML_ICON_SCAN_MAX_CHARS && !/<\/head\s*>/i.test(html)) {
      const { value, done } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
    }
    reader.cancel().catch(() => {});

    const links = html.match(/<link[^>]*>/gi) ?? [];
    const candidates: Array<{ order: number; score: number; url: string }> = [];

    for (const [order, linkTag] of links.entries()) {
      const relValue = extractHtmlAttribute(linkTag, "rel");
      if (!relValue || !linkRelDeclaresSiteIcon(relValue)) {
        continue;
      }
      const hrefValue = extractHtmlAttribute(linkTag, "href");
      if (!hrefValue) {
        continue;
      }
      try {
        const absoluteHref = new URL(hrefValue, origin).href;
        candidates.push({
          order,
          score: iconCandidateScore({
            rel: relValue,
            sizes: extractHtmlAttribute(linkTag, "sizes"),
            type: extractHtmlAttribute(linkTag, "type"),
            url: absoluteHref,
          }),
          url: absoluteHref,
        });
      } catch {
        // ignore malformed href values and continue trying later candidates
      }
    }

    const dedupedCandidates = new Map<string, { order: number; score: number; url: string }>();
    for (const candidate of candidates) {
      const existing = dedupedCandidates.get(candidate.url);
      if (!existing || candidate.score > existing.score) {
        dedupedCandidates.set(candidate.url, candidate);
      }
    }

    return [...dedupedCandidates.values()]
      .sort((left, right) => right.score - left.score || left.order - right.order)
      .map((candidate) => candidate.url);
  } catch {
    return [];
  }
}

/** Parse homepage HTML to find a first-match <link rel="icon"> href. */
export async function findIconFromHtml(origin: string): Promise<string | null> {
  const icons = await findIconsFromHtml(origin);
  return icons[0] ?? null;
}

export type FaviconResolutionSource =
  | "favicon_ico"
  | "html_link"
  | "google_s2"
  | "duckduckgo"
  | "feed_icon";

export type ResolveFeedFaviconUrlResult = {
  url: string;
  source: FaviconResolutionSource;
};

async function resolveHtmlFavicon(origin: string): Promise<ResolveFeedFaviconUrlResult | null> {
  const iconHrefs = await findIconsFromHtml(origin);
  for (const iconHref of iconHrefs) {
    const htmlIconResult = await tryFetchImageIfHostSafe(iconHref);
    if (htmlIconResult) {
      htmlIconResult.body?.cancel().catch(() => {});
      return { url: iconHref, source: "html_link" };
    }
  }
  return null;
}

async function resolveDirectFavicon(origin: string): Promise<ResolveFeedFaviconUrlResult | null> {
  const result = await tryFetchImage(`${origin}/favicon.ico`);
  if (!result) {
    return null;
  }
  result.body?.cancel().catch(() => {});
  return { url: `${origin}/favicon.ico`, source: "favicon_ico" };
}

async function resolveProviderFavicon(
  hostname: string,
): Promise<ResolveFeedFaviconUrlResult | null> {
  const googleUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=256`;
  const duckUrl = `https://icons.duckduckgo.com/ip3/${hostname}.ico`;

  try {
    return await Promise.any([
      tryFetchImage(googleUrl).then((result) => {
        if (result) {
          result.body?.cancel().catch(() => {});
          return { url: googleUrl, source: "google_s2" as FaviconResolutionSource };
        }
        throw new Error("No Google favicon found");
      }),
      tryFetchImage(duckUrl).then((result) => {
        if (result) {
          result.body?.cancel().catch(() => {});
          return { url: duckUrl, source: "duckduckgo" as FaviconResolutionSource };
        }
        throw new Error("No DuckDuckGo favicon found");
      }),
    ]);
  } catch {
    return null;
  }
}

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

  return (
    (await resolveHtmlFavicon(origin)) ??
    (await resolveDirectFavicon(origin)) ??
    (await resolveProviderFavicon(hostname))
  );
}
