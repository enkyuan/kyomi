import {
  createDrizzleFaviconHostStore,
  parseFaviconOrigin,
  resolvePersistedFaviconHost,
  tryFetchImageIfHostSafe,
  type FaviconDatabase,
  type FaviconHostStore,
} from "@kyomi/worker/favicon";

const FAVICON_CACHE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const FAVICON_CACHE_STALE_SECONDS = 60 * 60 * 24 * 30;
const FAVICON_MISS_CACHE_MAX_AGE_SECONDS = 120;
const FAVICON_MISS_CACHE_STALE_SECONDS = 600;
const FAVICON_MAX_RESPONSE_BYTES = 64 * 1024;

type FaviconFetchResult = { kind: "hit"; response: Response } | { kind: "miss"; terminal: boolean };

function faviconHitHeaders(contentType: string) {
  return {
    "Content-Type": contentType,
    "Cache-Control": `public, max-age=${FAVICON_CACHE_MAX_AGE_SECONDS}, stale-while-revalidate=${FAVICON_CACHE_STALE_SECONDS}`,
    Vary: "Accept",
  };
}

function faviconMissHeaders() {
  return {
    "Cache-Control": `public, max-age=${FAVICON_MISS_CACHE_MAX_AGE_SECONDS}, stale-while-revalidate=${FAVICON_MISS_CACHE_STALE_SECONDS}`,
  };
}

async function fetchResolvedFavicon(
  store: FaviconHostStore,
  origin: string,
  faviconUrl: string,
): Promise<FaviconFetchResult> {
  const upstream = await tryFetchImageIfHostSafe(faviconUrl);
  if (!upstream) {
    return { kind: "miss", terminal: false };
  }

  const contentType = upstream.headers.get("content-type") ?? "image/x-icon";
  const buffer = await upstream.arrayBuffer();
  if (buffer.byteLength > FAVICON_MAX_RESPONSE_BYTES) {
    await store.writeMiss({
      origin,
      hostname: new URL(origin).hostname,
      errorCode: "response_too_large",
      expiresAt: new Date(Date.now() + FAVICON_MISS_CACHE_MAX_AGE_SECONDS * 1000),
    });
    return { kind: "miss", terminal: true };
  }

  await store.updateResponseMetadata({
    origin,
    contentType,
  });

  return {
    kind: "hit",
    response: new Response(buffer, {
      status: 200,
      headers: faviconHitHeaders(contentType),
    }),
  };
}

export async function handleFaviconRequest(
  database: FaviconDatabase,
  request: Request,
): Promise<Response> {
  return handleFaviconRequestWithStore(createDrizzleFaviconHostStore(database), request);
}

export async function handleFaviconRequestWithStore(
  store: FaviconHostStore,
  request: Request,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const rawDomain = requestUrl.searchParams.get("domain") ?? "";
  const parsed = parseFaviconOrigin(rawDomain);
  if (!parsed) {
    return new Response("Invalid domain", { status: 400 });
  }

  const resolved = await resolvePersistedFaviconHost(store, parsed.origin);
  if (!resolved) {
    return new Response("Invalid domain", { status: 400 });
  }
  if (resolved.kind === "miss") {
    return new Response(null, {
      status: 404,
      headers: faviconMissHeaders(),
    });
  }

  const cachedResponse = await fetchResolvedFavicon(store, resolved.origin, resolved.url);
  if (cachedResponse.kind === "hit") {
    return cachedResponse.response;
  }
  if (cachedResponse.terminal) {
    return new Response(null, {
      status: 404,
      headers: faviconMissHeaders(),
    });
  }

  const refreshed = await resolvePersistedFaviconHost(store, parsed.origin, { forceRefresh: true });
  if (!refreshed || refreshed.kind === "miss") {
    return new Response(null, {
      status: 404,
      headers: faviconMissHeaders(),
    });
  }

  const refreshedResponse = await fetchResolvedFavicon(store, refreshed.origin, refreshed.url);
  if (refreshedResponse.kind === "hit") {
    return refreshedResponse.response;
  }

  return new Response(null, {
    status: 404,
    headers: faviconMissHeaders(),
  });
}
