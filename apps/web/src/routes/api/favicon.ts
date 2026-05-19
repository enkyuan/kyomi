import {
  ALLOWED_SCHEMES,
  assertSafeFaviconHost,
  findIconsFromHtml,
  tryFetchImage,
  tryFetchImageIfHostSafe,
} from "@vols.rss/worker/favicon";
import { createFileRoute } from "@tanstack/react-router";

const FAVICON_CACHE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const FAVICON_CACHE_STALE_SECONDS = 60 * 60 * 24 * 30;
const FAVICON_CACHE_TTL_MS = FAVICON_CACHE_MAX_AGE_SECONDS * 1000;
const FAVICON_MISS_CACHE_TTL_MS = 60 * 2 * 1000;
const FAVICON_CACHE_MAX_ENTRIES = 500;
const FAVICON_MAX_RESPONSE_BYTES = 64 * 1024;
const FAVICON_RESOLUTION_CACHE_VERSION = "html-first-v2";

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

function getFaviconCacheKey(hostname: string): string {
  return `${FAVICON_RESOLUTION_CACHE_VERSION}:${hostname}`;
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
  const cached = faviconResponseCache.get(getFaviconCacheKey(hostname));
  if (!cached) {
    return null;
  }
  if (cached.expiresAt <= Date.now()) {
    faviconResponseCache.delete(getFaviconCacheKey(hostname));
    return null;
  }
  if (cached.kind === "miss") {
    return new Response(null, {
      status: 404,
      headers: {
        "Cache-Control": "public, max-age=120, stale-while-revalidate=600",
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
  const buffer = await upstream.arrayBuffer();
  if (buffer.byteLength > FAVICON_MAX_RESPONSE_BYTES) {
    return new Response(null, { status: 404 });
  }
  const bodyBytes = new Uint8Array(buffer);
  setCachedFavicon(getFaviconCacheKey(hostname), {
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

/**
 * Proxy favicon fetches through our server so the client's browser never
 * contacts a third-party service (e.g. Google S2) directly, which would
 * leak the user's followed-feed domains.
 *
 * Fallback when feed rows have no persisted `favicon_url`.
 * Usage: GET /api/favicon?domain=https://example.com
 */
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

  const iconHrefs = await findIconsFromHtml(origin);
  const htmlIconResults = await Promise.all(
    iconHrefs.map((iconHref) => tryFetchImageIfHostSafe(iconHref)),
  );
  const htmlIconResult = htmlIconResults.find((result) => result != null);
  if (htmlIconResult) {
    return cacheAndBuildFaviconResponse(hostname, htmlIconResult);
  }

  const directResult = await tryFetchImage(`${origin}/favicon.ico`);
  if (directResult) {
    return cacheAndBuildFaviconResponse(hostname, directResult);
  }

  const googleResult = await tryFetchImage(
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`,
  );
  if (googleResult) {
    return cacheAndBuildFaviconResponse(hostname, googleResult);
  }

  const duckDuckGoResult = await tryFetchImage(`https://icons.duckduckgo.com/ip3/${hostname}.ico`);
  if (duckDuckGoResult) {
    return cacheAndBuildFaviconResponse(hostname, duckDuckGoResult);
  }

  setCachedFavicon(getFaviconCacheKey(hostname), {
    kind: "miss",
    expiresAt: Date.now() + FAVICON_MISS_CACHE_TTL_MS,
  });

  return new Response(null, {
    status: 404,
    headers: {
      "Cache-Control": "public, max-age=120, stale-while-revalidate=600",
    },
  });
}

export const Route = createFileRoute("/api/favicon")({
  server: {
    handlers: {
      GET: ({ request }) => handleFaviconRequest(request),
    },
  },
});
