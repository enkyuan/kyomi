import { Effect, Stream } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  type HttpClientError,
  type HttpClientResponse,
} from "effect/http";
import { assertHttpOrHttpsUrl } from "@shared/net/http";
import { checkOutboundUrl } from "@shared/net/outbound";
import { BadGateway, BadRequest, GatewayTimeout, PayloadTooLarge } from "@shared/effect/errors";
import { OPML_MAX_SOURCE_BYTES } from "./constants";

const DEFAULT_REMOTE_OPML_FILENAME = "remote.opml";
const FETCH_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 5;
const FETCH_HEADERS = {
  accept: "application/xml,text/xml,application/rss+xml,*/*;q=0.8",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 (KyomiFeedFetcher/1.0)",
} as const;

type FetchOpmlDocumentResult = {
  xml: string;
  finalUrl: string;
  filename: string;
};

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

const fetchFailed = (cause?: unknown) =>
  new BadGateway({
    message: "Could not fetch OPML URL",
    code: "OPML_URL_FETCH_FAILED",
    cause,
  });

function filenameFromUrl(url: string): string {
  const pathname = new URL(url).pathname;
  const lastSegment = pathname.split("/").filter(Boolean).pop();
  if (!lastSegment || !/\.(opml|xml)$/i.test(lastSegment)) {
    return DEFAULT_REMOTE_OPML_FILENAME;
  }

  try {
    return decodeURIComponent(lastSegment);
  } catch {
    return lastSegment;
  }
}

const parseOpmlImportUrl = (rawUrl: string) =>
  Effect.try({
    try: () => assertHttpOrHttpsUrl(rawUrl, "Only http(s) OPML URLs are supported"),
    catch: () => new BadRequest({ message: "Invalid OPML URL", code: "OPML_URL_INVALID" }),
  });

/**
 * Runs before the first request and before every redirect hop, so a public URL cannot bounce the
 * fetch into a private network. Only http(s) hops are allowed.
 */
const assertSafeRequest = Effect.fn("opml.fetch.assertSafe")(function* (
  request: HttpClientRequest.HttpClientRequest,
) {
  const url = yield* Effect.try({
    try: () => assertHttpOrHttpsUrl(request.url),
    catch: fetchFailed,
  });
  yield* checkOutboundUrl(url).pipe(
    Effect.catchTags({
      UnsafeOutboundUrl: (error) =>
        Effect.fail(
          new BadRequest({
            message: "This OPML URL cannot be imported",
            code: "OPML_URL_BLOCKED",
            cause: error,
          }),
        ),
      UpstreamError: (error) => Effect.fail(fetchFailed(error)),
    }),
  );
});

function classifyTransportError(error: HttpClientError.HttpClientError) {
  const cause = error.reason._tag === "TransportError" ? error.reason.cause : undefined;
  const code = cause instanceof Error && "code" in cause ? cause.code : undefined;
  if (typeof code === "string" && TLS_CERT_ERROR_CODES.has(code)) {
    return new BadGateway({
      message: "Could not verify OPML URL certificate",
      code: "OPML_URL_TLS_FAILED",
      cause: error,
    });
  }
  return fetchFailed(error);
}

/** Reads the body as UTF-8 text, failing as soon as it exceeds `maxBytes` (declared or streamed). */
const readBodyWithByteLimit = Effect.fnUntraced(function* (
  response: HttpClientResponse.HttpClientResponse,
  maxBytes: number,
) {
  const tooLarge = () =>
    new PayloadTooLarge({ message: "OPML payload exceeds maximum size", code: "OPML_TOO_LARGE" });
  const declared = /^\d+$/.test(response.headers["content-length"] ?? "")
    ? Number(response.headers["content-length"])
    : null;
  if (declared !== null && declared > maxBytes) {
    return yield* tooLarge();
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  yield* Stream.runForEach(response.stream, (chunk) => {
    received += chunk.byteLength;
    if (received > maxBytes) {
      return Effect.fail(tooLarge());
    }
    chunks.push(chunk);
    return Effect.void;
  });
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
});

/**
 * Downloads an OPML document from a user-supplied URL: http(s) only, every hop checked against the
 * private-network policy, at most MAX_REDIRECTS redirects, a size cap, and an overall deadline.
 * Closing the scope (on success, failure, timeout or interruption) aborts the request and body.
 */
export const fetchOpmlDocumentFromUrl = Effect.fn("opml.fetch")(function* (rawUrl: string) {
  const url = yield* parseOpmlImportUrl(rawUrl);
  const baseClient = yield* HttpClient.HttpClient;
  const client = baseClient.pipe(
    // `transform` wraps the per-request step that `followRedirects` re-runs for every hop
    // (`mapRequestEffect` would only guard the first request).
    HttpClient.transform((response, request) =>
      Effect.andThen(assertSafeRequest(request), response),
    ),
    HttpClient.followRedirects(MAX_REDIRECTS),
    HttpClient.withScope,
  );

  return yield* Effect.gen(function* () {
    const response = yield* client.execute(HttpClientRequest.get(url, { headers: FETCH_HEADERS }));

    if (response.status >= 300 && response.status < 400 && response.headers.location) {
      return yield* new BadRequest({
        message: "OPML URL redirected too many times",
        code: "OPML_URL_TOO_MANY_REDIRECTS",
      });
    }
    if (response.status < 200 || response.status >= 300) {
      return yield* new BadGateway({
        message: "Could not fetch OPML URL",
        code: "OPML_URL_HTTP_ERROR",
        details: { status: response.status },
      });
    }

    const xml = yield* readBodyWithByteLimit(response, OPML_MAX_SOURCE_BYTES);
    const finalUrl = new URL(response.request.url);
    const result: FetchOpmlDocumentResult = {
      xml,
      finalUrl: finalUrl.href,
      filename: filenameFromUrl(finalUrl.href),
    };
    return result;
  }).pipe(
    Effect.scoped,
    // fetch follows redirects itself unless told not to; every hop must pass `assertSafeRequest`.
    Effect.provideService(FetchHttpClient.RequestInit, { redirect: "manual" }),
    Effect.timeout(FETCH_TIMEOUT_MS),
    Effect.catchTags({
      HttpClientError: (error) => Effect.fail(classifyTransportError(error)),
      TimeoutError: () =>
        Effect.fail(
          new GatewayTimeout({
            message: "Timed out fetching OPML URL",
            code: "OPML_URL_FETCH_TIMEOUT",
          }),
        ),
    }),
  );
});
