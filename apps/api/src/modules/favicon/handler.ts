import { Clock, Effect } from "effect";
import {
  createDrizzleFaviconHostStore,
  parseFaviconOrigin,
  type FaviconHostStore,
} from "@kyomi/ingest/favicon";
import { Db } from "@adapters/db/service";
import { DatabaseError, unexpected } from "@shared/effect/errors";
import { makeLoadShedder } from "@shared/http/shed";
import { FaviconResolver } from "./service";

const FAVICON_CACHE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const FAVICON_CACHE_STALE_SECONDS = 60 * 60 * 24 * 30;
const FAVICON_MISS_CACHE_MAX_AGE_SECONDS = 120;
const FAVICON_MISS_CACHE_STALE_SECONDS = 600;
const FAVICON_MAX_RESPONSE_BYTES = 64 * 1024;
// Upstream bytes are attacker-controlled. If a favicon is opened as a top-level document (an SVG
// with <script>, say), this puts it in an opaque origin with no script or network access; <img>
// rendering is unaffected.
const FAVICON_CONTENT_SECURITY_POLICY = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

type FaviconFetchResult = { kind: "hit"; response: Response } | { kind: "miss"; terminal: boolean };

/**
 * What the favicon is served as. Only an image type is passed on: the upstream server also sends
 * `application/octet-stream` for `favicon.ico`, and a type it picked such as `text/html` must
 * never reach a browser from this origin.
 */
// A bare `type/subtype` token: `startsWith("image/")` would also pass `image/x-icon/../html`.
const IMAGE_TYPE = /^image\/[a-z0-9][a-z0-9.+-]*$/;

function servedContentType(upstream: Response): string {
  const declared = upstream.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  return declared && IMAGE_TYPE.test(declared) ? declared : "image/x-icon";
}

/** The body, or null as soon as it is known to exceed `limit` bytes; nothing past it is read. */
async function readCapped(
  response: Response,
  limit: number,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) {
    await response.body?.cancel().catch(() => {});
    return null;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body?.getReader();
  while (reader) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

function faviconHitHeaders(contentType: string) {
  return {
    "Content-Type": contentType,
    "Content-Security-Policy": FAVICON_CONTENT_SECURITY_POLICY,
    "X-Content-Type-Options": "nosniff",
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

  const contentType = servedContentType(upstream);
  const buffer = yield* Effect.tryPromise({
    try: () => readCapped(upstream, FAVICON_MAX_RESPONSE_BYTES),
    catch: unexpected,
  });
  if (buffer === null) {
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

/** Favicon lookups that may be fetching from the network at once; the route is public. */
const FAVICON_MAX_IN_FLIGHT = 24;
const shedFavicons = makeLoadShedder("favicon", FAVICON_MAX_IN_FLIGHT);

/** `GET /api/favicon?domain=`: the cached favicon image for a site, backed by the `Db` host cache. */
export const handleFaviconRequest = (request: Request) =>
  shedFavicons(
    Effect.flatMap(Db, (db) =>
      handleFaviconRequestWithStore(createDrizzleFaviconHostStore(db.client), request),
    ),
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
