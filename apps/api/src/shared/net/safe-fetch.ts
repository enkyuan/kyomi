import { Data, Effect, type Scope } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  type HttpClientResponse,
} from "effect/http";
import { UpstreamError } from "@shared/effect/errors";
import { assertHttpOrHttpsUrl } from "./http";
import { checkOutboundUrl, UnsafeOutboundUrl } from "./outbound";

export { UnsafeOutboundUrl };

const isRedirectStatus = (status: number) =>
  status === 301 || status === 302 || status === 303 || status === 307 || status === 308;

export class TooManyRedirects extends Data.TaggedError("TooManyRedirects")<{
  readonly maxRedirects: number;
}> {
  override get message() {
    return "Too many redirects";
  }
}

export type SafeFetchError = UnsafeOutboundUrl | TooManyRedirects | UpstreamError;

const resolveRedirect = (location: string, from: URL) =>
  Effect.try({
    try: () => assertHttpOrHttpsUrl(new URL(location, from).href),
    catch: (cause) =>
      new UnsafeOutboundUrl({
        message: cause instanceof Error ? cause.message : "Invalid redirect target",
        cause,
      }),
  });

/**
 * GET an untrusted URL through the `HttpClient` service with SSRF protection: every hop (the
 * initial URL and each redirect target) is resolved and checked against the private-network
 * policy before it is requested, and redirects are followed manually up to `maxRedirects`.
 *
 * The response body stays open until the caller's `Scope` closes, which also aborts a request the
 * caller interrupts, so run it inside `Effect.scoped` (or a Layer/route scope).
 */
export const safeFetch = Effect.fn("net.safeFetch")(function* (
  initialUrl: URL,
  options: {
    readonly headers?: Record<string, string>;
    readonly maxRedirects?: number;
    /** Skip TLS certificate verification (Bun's `tls` fetch option). Only for an explicit retry. */
    readonly insecureTls?: boolean;
  } = {},
): Effect.fn.Return<
  { readonly response: HttpClientResponse.HttpClientResponse; readonly finalUrl: URL },
  SafeFetchError,
  HttpClient.HttpClient | Scope.Scope
> {
  const client = HttpClient.withScope(yield* HttpClient.HttpClient);
  const maxRedirects = options.maxRedirects ?? 5;
  // `fetch` would follow redirects itself and skip the per-hop policy check.
  const requestInit = {
    redirect: "manual",
    ...(options.insecureTls ? { tls: { rejectUnauthorized: false } } : {}),
  } as const;
  let currentUrl = initialUrl;

  for (let redirects = 0; ; redirects += 1) {
    yield* checkOutboundUrl(currentUrl);
    const response = yield* client
      .execute(HttpClientRequest.get(currentUrl.href, { headers: options.headers }))
      .pipe(
        Effect.provideService(FetchHttpClient.RequestInit, requestInit),
        Effect.mapError((cause) => new UpstreamError({ operation: "outbound fetch", cause })),
      );

    const location = response.headers["location"];
    if (!isRedirectStatus(response.status) || !location) {
      return { response, finalUrl: currentUrl };
    }
    if (redirects === maxRedirects) {
      return yield* new TooManyRedirects({ maxRedirects });
    }
    currentUrl = yield* resolveRedirect(location, currentUrl);
  }
});
