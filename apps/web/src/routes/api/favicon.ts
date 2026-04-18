import {
  ALLOWED_SCHEMES,
  assertSafeFaviconHost,
  findIconFromHtml,
  tryFetchImage,
  tryFetchImageIfHostSafe,
} from "@cronos/favicon";
import { createFileRoute } from "@tanstack/react-router";

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

  const directResult = await tryFetchImage(`${origin}/favicon.ico`);
  if (directResult) {
    return cacheAndBuildFaviconResponse(hostname, directResult);
  }

  const iconHref = await findIconFromHtml(origin);
  if (iconHref) {
    const htmlIconResult = await tryFetchImageIfHostSafe(iconHref);
    if (htmlIconResult) {
      return cacheAndBuildFaviconResponse(hostname, htmlIconResult);
    }
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
