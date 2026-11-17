import { Clock, Effect } from "effect";
import {
  createDrizzleFaviconHostStore,
  parseFaviconOrigin,
  type FaviconHostStore,
} from "@kyomi/ingest/favicon";
import { Db } from "@adapters/db/service";
import { DatabaseError, unexpected } from "@shared/effect/errors";
import { FaviconResolver } from "./service";

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

const missResponse = () => new Response(null, { status: 404, headers: faviconMissHeaders() });

const useStore = <A>(operation: string, run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => new DatabaseError({ operation, cause }),
  });

const fetchResolvedFavicon = Effect.fn("favicon.fetch_resolved")(function* (
  store: FaviconHostStore,
  origin: string,
  faviconUrl: string,
) {
  const resolver = yield* FaviconResolver;
  const upstream = yield* resolver.fetchImage(faviconUrl);
  if (!upstream) {
    return { kind: "miss", terminal: false } satisfies FaviconFetchResult;
  }

  const contentType = upstream.headers.get("content-type") ?? "image/x-icon";
  const buffer = yield* Effect.tryPromise({
    try: () => upstream.arrayBuffer(),
    catch: unexpected,
  });
  if (buffer.byteLength > FAVICON_MAX_RESPONSE_BYTES) {
    const now = yield* Clock.currentTimeMillis;
    yield* useStore("favicon.write_miss", () =>
      store.writeMiss({
        origin,
        hostname: new URL(origin).hostname,
        errorCode: "response_too_large",
        expiresAt: new Date(now + FAVICON_MISS_CACHE_MAX_AGE_SECONDS * 1000),
      }),
    );
    return { kind: "miss", terminal: true } satisfies FaviconFetchResult;
  }

  yield* useStore("favicon.update_metadata", () =>
    store.updateResponseMetadata({ origin, contentType }),
  );

  return {
    kind: "hit",
    response: new Response(buffer, {
      status: 200,
      headers: faviconHitHeaders(contentType),
    }),
  } satisfies FaviconFetchResult;
});

/** `GET /api/favicon?domain=`: the cached favicon image for a site, backed by the `Db` host cache. */
export const handleFaviconRequest = (request: Request) =>
  Effect.flatMap(Db, (db) =>
    handleFaviconRequestWithStore(createDrizzleFaviconHostStore(db.client), request),
  );

export const handleFaviconRequestWithStore = Effect.fn("favicon.handle")(function* (
  store: FaviconHostStore,
  request: Request,
) {
  const resolver = yield* FaviconResolver;
  const requestUrl = new URL(request.url);
  const rawDomain = requestUrl.searchParams.get("domain") ?? "";
  const parsed = parseFaviconOrigin(rawDomain);
  if (!parsed) {
    return new Response("Invalid domain", { status: 400 });
  }

  const resolved = yield* resolver.resolveHost(store, parsed.origin);
  if (!resolved) {
    return new Response("Invalid domain", { status: 400 });
  }
  if (resolved.kind === "miss") {
    return missResponse();
  }

  const cachedResponse = yield* fetchResolvedFavicon(store, resolved.origin, resolved.url);
  if (cachedResponse.kind === "hit") {
    return cachedResponse.response;
  }
  if (cachedResponse.terminal) {
    return missResponse();
  }

  const refreshed = yield* resolver.resolveHost(store, parsed.origin, { forceRefresh: true });
  if (!refreshed || refreshed.kind === "miss") {
    return missResponse();
  }

  const refreshedResponse = yield* fetchResolvedFavicon(store, refreshed.origin, refreshed.url);
  if (refreshedResponse.kind === "hit") {
    return refreshedResponse.response;
  }

  return missResponse();
});
