import { Data, Effect, Stream } from "effect";
import type { HttpClientResponse } from "effect/http";
import { assertHttpOrHttpsUrl } from "@shared/net/http";
import { safeFetch, type SafeFetchError } from "@shared/net/safe-fetch";

export const ENRICHMENT_USER_AGENT =
  "Mozilla/5.0 (compatible; KyomiEnrichment/1.0; +https://kyomi.app)";

/**
 * A fetch that did not produce a usable body. `retryable` failures (network, timeout, 429, 5xx)
 * are worth another attempt; the rest will fail the same way again. Enrichment treats every one as
 * "skip this resource": it never fails the job.
 */
export class EnrichmentFetchError extends Data.TaggedError("EnrichmentFetchError")<{
  readonly reason: string;
  readonly retryable: boolean;
}> {
  override get message() {
    return `Enrichment fetch failed: ${this.reason}`;
  }
}

export type BoundedFetchOptions = {
  accept: string;
  timeoutMs: number;
  maxBytes: number;
  /**
   * Called with the bytes read so far after every chunk; returning true ends the read early.
   * Used to stop an image download once its header has yielded the dimensions.
   */
  until?: (bytes: Uint8Array) => boolean;
  /** Reject responses whose content type does not match. */
  contentType?: RegExp;
};

export type BoundedBody = { bytes: Uint8Array; contentType: string; truncated: boolean };

const permanent = (reason: string) => new EnrichmentFetchError({ reason, retryable: false });
const transient = (reason: string) => new EnrichmentFetchError({ reason, retryable: true });

function fromSafeFetchError(error: SafeFetchError): EnrichmentFetchError {
  switch (error._tag) {
    case "UnsafeOutboundUrl":
      return permanent("blocked_url");
    case "TooManyRedirects":
      return transient("TooManyRedirectsError");
    case "UpstreamError":
      return transient("network_error");
  }
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  if (chunks.length === 1) return chunks[0]!;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Reads the body up to `maxBytes`, stopping early once `until` is satisfied. */
const readBody = (response: HttpClientResponse.HttpClientResponse, options: BoundedFetchOptions) =>
  Effect.gen(function* () {
    const chunks: Uint8Array[] = [];
    let total = 0;
    let truncated = false;
    yield* response.stream.pipe(
      Stream.runForEachWhile((chunk) =>
        Effect.suspend(() => {
          total += chunk.byteLength;
          if (total > options.maxBytes) {
            return Effect.fail(permanent("too_large"));
          }
          chunks.push(chunk);
          if (options.until?.(concat(chunks, total))) {
            truncated = true;
            return Effect.succeed(false);
          }
          return Effect.succeed(true);
        }),
      ),
      Effect.catchTag("HttpClientError", (error) =>
        // A response without a body is an empty body, not a failure.
        error.reason._tag === "EmptyBodyError"
          ? Effect.void
          : Effect.fail(transient("network_error")),
      ),
    );
    return { bytes: total === 0 ? new Uint8Array() : concat(chunks, total), truncated };
  });

/**
 * GET through the SSRF-safe redirect fetcher with a time and size bound. Private, loopback, and
 * metadata addresses are rejected on the initial URL and on every redirect hop. Interrupting the
 * effect, or hitting the timeout, aborts the request, and the connection is released when it ends.
 */
export const fetchBounded = Effect.fn("articles.documentEnrichment.fetchBounded")(function* (
  rawUrl: string,
  options: BoundedFetchOptions,
) {
  const url = yield* Effect.try({
    try: () => assertHttpOrHttpsUrl(rawUrl),
    catch: () => permanent("invalid_url"),
  });

  return yield* Effect.scoped(
    Effect.gen(function* () {
      const { response } = yield* safeFetch(url, {
        headers: { accept: options.accept, "user-agent": ENRICHMENT_USER_AGENT },
        maxRedirects: 4,
      }).pipe(Effect.mapError(fromSafeFetchError));

      if (response.status < 200 || response.status > 299) {
        return yield* new EnrichmentFetchError({
          reason: `status_${response.status}`,
          retryable: response.status === 429 || response.status >= 500,
        });
      }
      const contentType =
        response.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
      if (options.contentType && !options.contentType.test(contentType)) {
        return yield* permanent("unexpected_content_type");
      }
      const declared = Number(response.headers["content-length"]);
      if (Number.isFinite(declared) && declared > options.maxBytes && !options.until) {
        return yield* permanent("too_large");
      }
      const { bytes, truncated } = yield* readBody(response, options);
      return { bytes, contentType, truncated } satisfies BoundedBody;
    }),
  ).pipe(
    Effect.timeoutOrElse({
      duration: options.timeoutMs,
      orElse: () => Effect.fail(transient("TimeoutError")),
    }),
  );
});
