import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

const blockedAddressList = new BlockList();
blockedAddressList.addSubnet("0.0.0.0", 8, "ipv4");
blockedAddressList.addSubnet("10.0.0.0", 8, "ipv4");
blockedAddressList.addSubnet("100.64.0.0", 10, "ipv4");
blockedAddressList.addSubnet("127.0.0.0", 8, "ipv4");
blockedAddressList.addSubnet("169.254.0.0", 16, "ipv4");
blockedAddressList.addSubnet("172.16.0.0", 12, "ipv4");
blockedAddressList.addSubnet("192.168.0.0", 16, "ipv4");
blockedAddressList.addSubnet("::", 128, "ipv6");
blockedAddressList.addSubnet("::1", 128, "ipv6");
blockedAddressList.addSubnet("fc00::", 7, "ipv6");
blockedAddressList.addSubnet("fe80::", 10, "ipv6");

const blockedExactHostnames = new Set(["localhost", "metadata.google.internal"]);
const blockedHostnameSuffixes = [".localhost", ".local", ".internal", ".home.arpa"];
const FAVICON_CACHE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const FAVICON_CACHE_STALE_SECONDS = 60 * 60 * 24 * 30;
const FAVICON_CACHE_TTL_MS = FAVICON_CACHE_MAX_AGE_SECONDS * 1000;
const FAVICON_MISS_CACHE_TTL_MS = 60 * 30 * 1000;
const FAVICON_CACHE_MAX_ENTRIES = 500;
const FAVICON_MAX_RESPONSE_BYTES = 64 * 1024;

type CachedFavicon =
  | {
      kind: "hit";
      body: Uint8Array;
      contentType: string;
      expiresAt: number;
    }
  | {
      kind: "miss";
      expiresAt: number;
    };

const faviconResponseCache = new Map<string, CachedFavicon>();

function setCachedFavicon(hostname: string, value: CachedFavicon) {
  if (faviconResponseCache.size >= FAVICON_CACHE_MAX_ENTRIES) {
    const oldest = faviconResponseCache.keys().next().value;
    if (oldest !== undefined) {
      faviconResponseCache.delete(oldest);
    }
  }
  faviconResponseCache.set(hostname, value);
}

function canonicalHostname(hostname: string): string {
  const withoutBrackets =
    hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  return withoutBrackets.toLowerCase().replace(/\.+$/, "");
}

function isBlockedHostname(hostname: string): boolean {
  return (
    blockedExactHostnames.has(hostname) ||
    blockedHostnameSuffixes.some((suffix) => hostname.endsWith(suffix))
  );
}

function normalizeIpAddress(address: string): string {
  const normalized = canonicalHostname(address);
  const mappedIpv4Prefix = "::ffff:";
  if (!normalized.startsWith(mappedIpv4Prefix)) {
    return normalized;
  }
  const mappedIpv4 = normalized.slice(mappedIpv4Prefix.length);
  return isIP(mappedIpv4) === 4 ? mappedIpv4 : normalized;
}

function isBlockedIpAddress(address: string): boolean {
  const normalized = normalizeIpAddress(address);
  const family = isIP(normalized);
  if (family === 0) {
    return false;
  }
  return blockedAddressList.check(normalized, family === 6 ? "ipv6" : "ipv4");
}

async function assertSafeFaviconHost(hostname: string): Promise<boolean> {
  const canonical = canonicalHostname(hostname);
  if (!canonical || isBlockedHostname(canonical)) {
    return false;
  }

  let addresses: string[];
  if (isIP(canonical) !== 0) {
    addresses = [canonical];
  } else {
    try {
      const lookupPromise = lookup(canonical, { all: true, verbatim: true });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DNS timeout")), 1500),
      );
      const resolved = (await Promise.race([lookupPromise, timeoutPromise])) as {
        address: string;
      }[];
      addresses = [...new Set(resolved.map((r) => normalizeIpAddress(r.address)))];
    } catch {
      return false;
    }
  }

  return !addresses.some((addr) => isBlockedIpAddress(addr));
}

/**
 * Proxy favicon fetches through our server so the client's browser never
 * contacts a third-party service (e.g. Google S2) directly, which would
 * leak the user's followed-feed domains.
 *
 * Usage: GET /api/favicon?domain=https://example.com
 */
const FETCH_OPTIONS = {
  headers: { Accept: "image/*,*/*" },
  redirect: "follow" as const,
  signal: undefined as AbortSignal | undefined,
};

/** Try fetching a URL and return the response only if it looks like a valid image. */
async function tryFetchImage(imageUrl: string): Promise<Response | null> {
  try {
    const response = await fetch(imageUrl, {
      ...FETCH_OPTIONS,
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) {
      // Cancelling the body prevents leaving the stream open; ignore cancel errors.
      response.body?.cancel().catch(() => {});
      return null;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/") && !contentType.includes("icon")) {
      // Cancelling the body prevents leaving the stream open; ignore cancel errors.
      response.body?.cancel().catch(() => {});
      return null;
    }
    return response;
  } catch {
    return null;
  }
}

async function tryFetchImageIfHostSafe(imageUrl: string): Promise<Response | null> {
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
async function findIconFromHtml(origin: string): Promise<string | null> {
  try {
    const response = await fetch(origin, {
      headers: { Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return null;
    // Only read the first 16KB to find <link> tags in <head>
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

function buildCachedFaviconResponse(cached: CachedFavicon): Response | null {
  if (cached.kind !== "hit") {
    return null;
  }
  return new Response(cached.body.slice(), {
    status: 200,
    headers: {
      "Content-Type": cached.contentType,
      "Cache-Control": `public, max-age=${FAVICON_CACHE_MAX_AGE_SECONDS}, stale-while-revalidate=${FAVICON_CACHE_STALE_SECONDS}`,
      Vary: "Accept",
    },
  });
}

function readCache(hostname: string): Response | null {
  const cached = faviconResponseCache.get(hostname);
  if (!cached) {
    return null;
  }
  if (cached.expiresAt <= Date.now()) {
    faviconResponseCache.delete(hostname);
    return null;
  }
  if (cached.kind === "miss") {
    return new Response(null, {
      status: 404,
      headers: {
        "Cache-Control": "public, max-age=1800, stale-while-revalidate=3600",
      },
    });
  }
  return buildCachedFaviconResponse(cached);
}

async function cacheAndBuildFaviconResponse(
  hostname: string,
  upstream: Response,
): Promise<Response> {
  const contentType = upstream.headers.get("content-type") ?? "image/x-icon";
  const reader = upstream.body?.getReader();
  if (!reader) {
    return new Response(null, { status: 404 });
  }
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > FAVICON_MAX_RESPONSE_BYTES) {
      reader.cancel();
      return new Response(null, { status: 404 });
    }
    chunks.push(value);
  }
  const bodyBytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  setCachedFavicon(hostname, {
    kind: "hit",
    body: bodyBytes,
    contentType,
    expiresAt: Date.now() + FAVICON_CACHE_TTL_MS,
  });
  return new Response(bodyBytes.slice(), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": `public, max-age=${FAVICON_CACHE_MAX_AGE_SECONDS}, stale-while-revalidate=${FAVICON_CACHE_STALE_SECONDS}`,
      Vary: "Accept",
    },
  });
}

async function handleFaviconRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rawDomain = url.searchParams.get("domain") ?? "";

  let origin: string;
  let hostname: string;
  try {
    const parsed = new URL(rawDomain);
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
      return new Response("Invalid domain", { status: 400 });
    }
    origin = parsed.origin;
    hostname = parsed.hostname;
  } catch {
    return new Response("Invalid domain", { status: 400 });
  }

  const isSafe = await assertSafeFaviconHost(hostname);
  if (!isSafe) {
    return new Response("Invalid domain", { status: 400 });
  }

  const cachedResponse = readCache(hostname);
  if (cachedResponse) {
    return cachedResponse;
  }

  // Strategy 1: Try /favicon.ico directly (fastest, works for most major sites)
  const directResult = await tryFetchImage(`${origin}/favicon.ico`);
  if (directResult) {
    return cacheAndBuildFaviconResponse(hostname, directResult);
  }

  // Strategy 2: Parse the homepage HTML for <link rel="icon">
  const iconHref = await findIconFromHtml(origin);
  if (iconHref) {
    const htmlIconResult = await tryFetchImageIfHostSafe(iconHref);
    if (htmlIconResult) {
      return cacheAndBuildFaviconResponse(hostname, htmlIconResult);
    }
  }

  // Strategy 3: Proxy through Google's public favicon service
  const googleResult = await tryFetchImage(
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`,
  );
  if (googleResult) {
    return cacheAndBuildFaviconResponse(hostname, googleResult);
  }

  // Strategy 4: Fallback provider with broad domain coverage.
  const duckDuckGoResult = await tryFetchImage(`https://icons.duckduckgo.com/ip3/${hostname}.ico`);
  if (duckDuckGoResult) {
    return cacheAndBuildFaviconResponse(hostname, duckDuckGoResult);
  }

  setCachedFavicon(hostname, {
    kind: "miss",
    expiresAt: Date.now() + FAVICON_MISS_CACHE_TTL_MS,
  });

  return new Response(null, { status: 404 });
}

export const Route = createFileRoute("/api/favicon")({
  server: {
    handlers: {
      GET: ({ request }) => handleFaviconRequest(request),
    },
  },
});
