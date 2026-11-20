import { assetLifetime } from "@adapters/assets/freshness";
import { Assets } from "@adapters/assets/garage";
import { Data, Effect, Stream } from "effect";
import type { HttpClientResponse } from "effect/http";
import { AppLogger } from "@adapters/logger/service";
import { makeLoadShedder } from "@shared/http/shed";
import { assertHttpOrHttpsUrl } from "@shared/net/http";
import { safeFetch, type SafeFetchError } from "@shared/net/safe-fetch";

const READER_IMAGE_CACHE_MAX_AGE_SECONDS = 60 * 60 * 24;

const READER_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const READER_IMAGE_TIMEOUT = "8 seconds";
const READER_IMAGE_MAX_REDIRECTS = 5;
// Upstream bytes are attacker-controlled. If a proxied response is opened as a top-level
// document (for example an SVG with <script>), this sandboxes it into an opaque origin with no
// script or network access. <img> rendering is unaffected.
const READER_IMAGE_CONTENT_SECURITY_POLICY =
  "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox";
// Prefer formats that work across the Expo DOM WebView fleet. Some CDNs serve AVIF only when it
// is explicitly requested, even when the source is a JPEG.
const READER_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/*;q=0.8,*/*;q=0.5";

type ReaderImageMissReason =
  | "missing_url"
  | "invalid_url"
  | "blocked_url"
  | "too_many_redirects"
  | "upstream_failed"
  | "upstream_status"
  | "not_an_image"
  | "too_large"
  | "timed_out";

/**
 * Every way the proxy can decline to serve an image. The reader document only ever sees an empty
 * 400/404 (upstream URL, DNS and network detail stay server side); `reason` is for the log.
 */
class ReaderImageMiss extends Data.TaggedError("ReaderImageMiss")<{
  readonly reason: ReaderImageMissReason;
  readonly status: 400 | 404;
  readonly host?: string;
  readonly cause?: unknown;
}> {}

type ReaderImage = { readonly contentType: string; readonly bytes: Uint8Array<ArrayBuffer> };

function imageHitHeaders(contentType: string, ttl: number) {
  return {
    "Cache-Control": ttl > 0 ? `public, max-age=${ttl}` : "no-store",
    "Content-Security-Policy": READER_IMAGE_CONTENT_SECURITY_POLICY,
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  };
}

function imageMiss(status: 400 | 404) {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "public, max-age=120, stale-while-revalidate=600",
    },
  });
}

function parseSourceUrl(rawUrl: string | null) {
  if (!rawUrl) {
    return Effect.fail(new ReaderImageMiss({ reason: "missing_url", status: 400 }));
  }
  return Effect.try({
    try: () => assertHttpOrHttpsUrl(rawUrl),
    catch: (cause) => new ReaderImageMiss({ reason: "invalid_url", status: 400, cause }),
  });
}

function displayableImageType(response: HttpClientResponse.HttpClientResponse): string | null {
  const contentType = response.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase();
  return contentType && /^image\/[a-z0-9][a-z0-9.+-]*$/.test(contentType) ? contentType : null;
}

function declaredLength(response: HttpClientResponse.HttpClientResponse): number | null {
  const raw = response.headers["content-length"];
  if (!raw || !/^\d+$/.test(raw)) {
    return null;
  }
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

/** Reads the body while enforcing the byte limit up front (content-length) and while streaming. */
const readBoundedBytes = Effect.fn("reader.image.read")(function* (
  response: HttpClientResponse.HttpClientResponse,
  host: string,
) {
  const tooLarge = new ReaderImageMiss({ reason: "too_large", status: 404, host });
  const length = declaredLength(response);
  if (length !== null && length > READER_IMAGE_MAX_BYTES) {
    return yield* tooLarge;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  yield* Stream.runForEach(response.stream, (chunk) => {
    total += chunk.byteLength;
    if (total > READER_IMAGE_MAX_BYTES) {
      return Effect.fail(tooLarge);
    }
    chunks.push(chunk);
    return Effect.void;
  }).pipe(
    Effect.mapError((error) =>
      error instanceof ReaderImageMiss
        ? error
        : new ReaderImageMiss({ reason: "upstream_failed", status: 404, host, cause: error }),
    ),
  );

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
});

function fetchFailure(error: SafeFetchError, host: string) {
  const reason: ReaderImageMissReason =
    error._tag === "UnsafeOutboundUrl"
      ? "blocked_url"
      : error._tag === "TooManyRedirects"
        ? "too_many_redirects"
        : "upstream_failed";
  return new ReaderImageMiss({ reason, status: 404, host, cause: error });
}

const fetchOriginImage = Effect.fn("reader.image.origin")(function* (source: URL) {
  const host = source.hostname;
  const { response } = yield* safeFetch(source, {
    headers: { Accept: READER_IMAGE_ACCEPT },
    maxRedirects: READER_IMAGE_MAX_REDIRECTS,
  }).pipe(Effect.mapError((error) => fetchFailure(error, host)));

  if (response.status < 200 || response.status > 299) {
    return yield* new ReaderImageMiss({ reason: "upstream_status", status: 404, host });
  }
  const contentType = displayableImageType(response);
  if (!contentType) {
    return yield* new ReaderImageMiss({ reason: "not_an_image", status: 404, host });
  }
  const bytes = yield* readBoundedBytes(response, host);
  const asset = { contentType, bytes } satisfies ReaderImage;
  const ttl = assetLifetime(
    { get: (name) => response.headers[name] ?? null },
    READER_IMAGE_CACHE_MAX_AGE_SECONDS,
  );
  return {
    asset,
    ttl,
    validators: {
      etag: response.headers.etag ?? null,
      lastModified: response.headers["last-modified"] ?? null,
    },
  };
});

/**
 * Fetches a bounded, SSRF-protected remote image. The deadline covers the request and the body,
 * and the connection is released with the scope however the effect ends.
 */
export const loadReaderImage = Effect.fn("reader.image.load")(function* (rawUrl: string | null) {
  const source = yield* parseSourceUrl(rawUrl);
  const assets = yield* Assets;
  const key = "article:" + source.href;
  const saved = yield* assets.get(key, READER_IMAGE_MAX_BYTES);
  if (saved) return saved;
  const { asset, ttl, validators } = yield* fetchOriginImage(source).pipe(
    Effect.timeout(READER_IMAGE_TIMEOUT),
    Effect.catchTag("TimeoutError", () =>
      Effect.fail(new ReaderImageMiss({ reason: "timed_out", status: 404, host: source.hostname })),
    ),
    Effect.scoped,
  );
  yield* assets.put(key, asset, ttl, validators);
  return { ...asset, ttl };
});

/** Image fetches that may be open at once, each up to 8 MiB and 8 s; the route is public. */
const READER_IMAGE_MAX_IN_FLIGHT = 16;
const shedReaderImages = makeLoadShedder("reader-image", READER_IMAGE_MAX_IN_FLIGHT);

/**
 * Serves a bounded, SSRF-protected remote image for the Expo DOM reader.
 * The public publisher URL remains the source of truth for the optional private object cache.
 */
export const serveReaderImage = Effect.fn("reader.image.serve")(function* (requestUrl: string) {
  const log = yield* AppLogger;
  const rawUrl = new URL(requestUrl).searchParams.get("url");
  return yield* shedReaderImages(loadReaderImage(rawUrl)).pipe(
    Effect.map(
      ({ contentType, bytes, ttl }) =>
        new Response(bytes, { status: 200, headers: imageHitHeaders(contentType, ttl) }),
    ),
    Effect.catchTag("ReaderImageMiss", (miss) => {
      const event = miss.reason === "blocked_url" ? log.warn : log.info;
      const logged =
        miss.status === 400
          ? Effect.void
          : event("reader.image.miss", { reason: miss.reason, host: miss.host });
      return logged.pipe(Effect.as(imageMiss(miss.status)));
    }),
  );
});
