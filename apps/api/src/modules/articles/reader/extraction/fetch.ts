import { Effect, Stream } from "effect";
import { HttpClientError, type HttpClientResponse } from "effect/http";
import type { HostRateLimiter } from "@kyomi/ingest";
import { RedisError, type UpstreamError } from "@shared/effect/errors";
import { assertHttpOrHttpsUrl } from "@shared/net/http";
import { safeFetch, type SafeFetchError } from "@shared/net/safe-fetch";
import { blockedUrl, ExtractionFailed } from "./errors";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECT_HOPS = 5;

const REQUEST_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
  "accept-language": "en-US,en;q=0.9",
};

export type FetchedArticleDocument = {
  readonly finalUrl: string;
  readonly body: string;
  readonly contentType: string;
};

const tooLarge = () =>
  new ExtractionFailed({
    errorCode: "TOO_LARGE",
    errorMessage: "This source is too large to preview in the reader.",
  });

const timedOut = () =>
  new ExtractionFailed({
    errorCode: "TIMEOUT",
    errorMessage: "Full preview unavailable right now.",
  });

function isReadableDocumentContentType(contentType: string): boolean {
  return (
    contentType.includes("text/html") ||
    contentType.includes("application/xhtml+xml") ||
    contentType.includes("text/plain")
  );
}

/** The message of the underlying transport failure, so a cached failure says what went wrong. */
function transportMessage(error: UpstreamError | HttpClientError.HttpClientError): string | null {
  const cause = HttpClientError.isHttpClientError(error) ? error : error.cause;
  if (HttpClientError.isHttpClientError(cause)) {
    const inner = "cause" in cause.reason ? cause.reason.cause : undefined;
    return inner instanceof Error ? inner.message : cause.message;
  }
  return cause instanceof Error ? cause.message : null;
}

function fetchFailure(error: SafeFetchError | HttpClientError.HttpClientError): ExtractionFailed {
  if (error._tag === "UnsafeOutboundUrl") {
    return blockedUrl();
  }
  const detail =
    error._tag === "TooManyRedirects" ? "Too many redirects." : transportMessage(error);
  return new ExtractionFailed({
    errorCode: "FETCH_FAILED",
    errorMessage: detail ? `Extraction failed: ${detail}` : "Extraction failed.",
    cause: error,
  });
}

/** Read a body as UTF-8 text, stopping the transfer as soon as it passes `maxBytes`. */
const readBodyWithByteLimit = (response: HttpClientResponse.HttpClientResponse, maxBytes: number) =>
  Effect.gen(function* () {
    const declared = response.headers["content-length"];
    if (declared !== undefined && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
      return yield* tooLarge();
    }

    const chunks: Uint8Array[] = [];
    let bytesRead = 0;
    let exceeded = false;
    yield* Stream.runForEachWhile(response.stream, (chunk) =>
      Effect.sync(() => {
        if (bytesRead + chunk.byteLength > maxBytes) {
          exceeded = true;
          return false;
        }
        chunks.push(chunk);
        bytesRead += chunk.byteLength;
        return true;
      }),
    );
    if (exceeded) {
      return yield* tooLarge();
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
  });

const fetchDocument = (initialUrl: URL) =>
  Effect.gen(function* () {
    const { response, finalUrl } = yield* safeFetch(initialUrl, {
      headers: REQUEST_HEADERS,
      maxRedirects: MAX_REDIRECT_HOPS,
    });

    if (response.status < 200 || response.status > 299) {
      return yield* new ExtractionFailed({
        errorCode: "FETCH_FAILED",
        errorMessage: `Extraction failed (HTTP ${response.status}).`,
      });
    }

    const contentType = response.headers["content-type"] ?? "";
    if (!isReadableDocumentContentType(contentType)) {
      return yield* new ExtractionFailed({
        errorCode: "NOT_HTML",
        errorMessage: "This source does not expose a readable article document.",
      });
    }

    const body = yield* readBodyWithByteLimit(response, MAX_HTML_BYTES);
    return { finalUrl: finalUrl.href, body, contentType } satisfies FetchedArticleDocument;
  }).pipe(
    Effect.catchTags({
      UnsafeOutboundUrl: (error) => Effect.fail(fetchFailure(error)),
      TooManyRedirects: (error) => Effect.fail(fetchFailure(error)),
      UpstreamError: (error) => Effect.fail(fetchFailure(error)),
      HttpClientError: (error) => Effect.fail(fetchFailure(error)),
    }),
  );

/**
 * GET an article page through the `HttpClient` service with the outbound-URL policy applied to
 * every hop. One 12s budget covers connecting, redirects and reading the body; the scope closing
 * (on success, failure, timeout or interruption) aborts the request and releases the connection.
 */
export const fetchArticleDocument = Effect.fn("extraction.fetch")(function* (url: string) {
  const initialUrl = yield* Effect.try({
    try: () => assertHttpOrHttpsUrl(url),
    catch: blockedUrl,
  });
  return yield* fetchDocument(initialUrl).pipe(
    Effect.scoped,
    Effect.timeout(FETCH_TIMEOUT_MS),
    Effect.catchTag("TimeoutError", () => Effect.fail(timedOut())),
  );
});

/**
 * Run `effect` while holding the per-host lease from the legacy `HostRateLimiter`. The limiter is a
 * Promise API over Redis, so it is wrapped once here: its Redis failures become `RedisError`, the
 * wrapped effect keeps its own typed failures, and interrupting the caller aborts the held effect.
 */
export const withHostRateLimit = <A, E, R>(
  limiter: HostRateLimiter | undefined,
  url: string,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E | RedisError, R> => {
  if (!limiter) {
    return effect;
  }
  return Effect.gen(function* () {
    const run = Effect.runPromiseExitWith(yield* Effect.context<R>());
    const exit = yield* Effect.tryPromise({
      try: (signal) => limiter.run(url, () => run(effect, { signal })),
      catch: (cause) => new RedisError({ operation: "host rate limit", cause }),
    });
    return yield* exit;
  });
};
