import { Data, Effect, Stream } from "effect";
import type { HttpClient, HttpClientResponse } from "effect/http";
import { BlockedOutboundUrlError } from "@shared/net/outbound";
import {
  safeFetch,
  type SafeFetchError,
  type TooManyRedirects,
  type UnsafeOutboundUrl,
} from "@shared/net/safe-fetch";
import type { UpstreamError } from "@shared/effect/errors";
import { assertHttpOrHttpsUrl, LOGIN_URL_MESSAGE } from "./normalize";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const FETCH_HEADERS = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml,application/atom+xml,application/json,*/*;q=0.8",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 (KyomiFeedFetcher/1.0)",
} as const;

export type FetchFeedErrorCode =
  | "FETCH_FAILED"
  | "FETCH_TIMEOUT"
  | "TLS_CERTIFICATE_FAILED"
  | "HTTP_ERROR"
  | "TOO_MANY_REDIRECTS"
  | "RESPONSE_TOO_LARGE"
  | "BLOCKED_URL";

export type FetchedFeedDocument = {
  finalUrl: string;
  body: string;
  contentType: string;
};

/** The feed document could not be fetched. `code` says why; `status` is set for `HTTP_ERROR`. */
export class FeedFetchFailed extends Data.TaggedError("FeedFetchFailed")<{
  readonly code: FetchFeedErrorCode;
  readonly message: string;
  readonly status?: number;
}> {}

/** TLS verification failures, by the error `code` the runtime sets (never by message text). */
const TLS_CERT_ERROR_CODES = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "CERT_HAS_EXPIRED",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);

/** The error and the causes beneath it, outermost first (`HttpClientError` hides its in `reason`). */
function* errorChain(error: unknown): Generator<Error> {
  let current: unknown = error;
  for (let depth = 0; current instanceof Error && depth < 8; depth += 1) {
    yield current;
    const wrapped = current as { cause?: unknown; reason?: { cause?: unknown } };
    current = wrapped.cause ?? wrapped.reason?.cause;
  }
}

function hasTlsCertificateCode(error: unknown): boolean {
  for (const link of errorChain(error)) {
    const code = (link as { code?: unknown }).code;
    if (typeof code === "string" && TLS_CERT_ERROR_CODES.has(code)) {
      return true;
    }
  }
  return false;
}

/** The deepest message in the chain: the runtime's own words, not an Effect wrapper's. */
function rootMessage(error: unknown): string {
  let message = "fetch failed";
  for (const link of errorChain(error)) {
    if (link.message) {
      message = link.message;
    }
  }
  return message;
}

function classifySafeFetchError(
  error: UnsafeOutboundUrl | TooManyRedirects | UpstreamError,
): FeedFetchFailed {
  switch (error._tag) {
    case "UnsafeOutboundUrl":
      return error.cause instanceof BlockedOutboundUrlError
        ? new FeedFetchFailed({ code: "BLOCKED_URL", message: error.message })
        : new FeedFetchFailed({ code: "FETCH_FAILED", message: error.message });
    case "TooManyRedirects":
      return new FeedFetchFailed({ code: "TOO_MANY_REDIRECTS", message: "Too many redirects" });
    case "UpstreamError":
      return new FeedFetchFailed({
        code: hasTlsCertificateCode(error) ? "TLS_CERTIFICATE_FAILED" : "FETCH_FAILED",
        message: rootMessage(error),
      });
  }
}

/** Reads the body as UTF-8 text, failing as soon as it exceeds `MAX_BYTES` (declared or streamed). */
const readBody = Effect.fnUntraced(function* (response: HttpClientResponse.HttpClientResponse) {
  const tooLarge = () =>
    new FeedFetchFailed({ code: "RESPONSE_TOO_LARGE", message: "Feed response too large" });
  const declared = response.headers["content-length"];
  if (declared !== undefined && /^\d+$/.test(declared) && Number(declared) > MAX_BYTES) {
    return yield* tooLarge();
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  yield* Stream.runForEach(response.stream, (chunk) => {
    received += chunk.byteLength;
    if (received > MAX_BYTES) {
      return Effect.fail(tooLarge());
    }
    chunks.push(chunk);
    return Effect.void;
  }).pipe(
    Effect.catchTag("HttpClientError", (error) =>
      Effect.fail(new FeedFetchFailed({ code: "FETCH_FAILED", message: rootMessage(error) })),
    ),
  );
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
});

/**
 * Fetches a feed or HTML document from an untrusted URL: every hop is checked against the
 * private-network policy, with a redirect cap, a size cap and one deadline that covers headers and
 * body. Closing the scope (success, failure, timeout or interruption) aborts the request.
 */
export const fetchFeedDocument = Effect.fn("discover.fetchFeedDocument")(function* (
  url: string,
  options?: { ignoreTlsError?: boolean },
): Effect.fn.Return<FetchedFeedDocument, FeedFetchFailed, HttpClient.HttpClient> {
  const target = yield* Effect.try({
    try: () => assertHttpOrHttpsUrl(url),
    catch: (cause) =>
      new FeedFetchFailed({
        code: "FETCH_FAILED",
        message: cause instanceof Error ? cause.message : "fetch failed",
      }),
  });

  return yield* Effect.gen(function* () {
    const { response, finalUrl } = yield* safeFetch(target, {
      headers: FETCH_HEADERS,
      maxRedirects: MAX_REDIRECTS,
      insecureTls: options?.ignoreTlsError === true,
    }).pipe(Effect.mapError((error: SafeFetchError) => classifySafeFetchError(error)));
    // The final URL becomes the stored feed URL, shared by every follower, and a redirect can add a
    // login to it. Redirects are followed as before; the document is not accepted.
    if (finalUrl.username || finalUrl.password) {
      return yield* new FeedFetchFailed({ code: "BLOCKED_URL", message: LOGIN_URL_MESSAGE });
    }
    if (response.status < 200 || response.status >= 300) {
      return yield* new FeedFetchFailed({
        code: "HTTP_ERROR",
        message: `HTTP ${response.status}`,
        status: response.status,
      });
    }
    const body = yield* readBody(response);
    return { finalUrl: finalUrl.href, body, contentType: response.headers["content-type"] ?? "" };
  }).pipe(
    Effect.scoped,
    Effect.timeout(FETCH_TIMEOUT_MS),
    Effect.catchTag("TimeoutError", () =>
      Effect.fail(new FeedFetchFailed({ code: "FETCH_TIMEOUT", message: "Feed fetch timed out" })),
    ),
  );
});
