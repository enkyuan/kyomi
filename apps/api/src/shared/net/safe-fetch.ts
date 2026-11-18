import { Data, Effect, Exit, type Scope } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  type HttpClientResponse,
} from "effect/http";
import { pinnedFetch } from "@kyomi/ingest/lib/outbound";
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

/** IPv4 first: a server with no IPv6 route would otherwise fail on an address it cannot reach. */
const ipv4First = (addresses: readonly string[]) =>
  [...addresses].sort((a, b) => Number(a.includes(":")) - Number(b.includes(":")));

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
 * policy before it is requested, and redirects are followed manually up to `maxRedirects`. The
 * request connects to an address that was checked (`pinnedFetch`), so a hostname that answers
 * differently the second time cannot send it somewhere else.
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
    const addresses = ipv4First(yield* checkOutboundUrl(currentUrl));
    const request = HttpClientRequest.get(currentUrl.href, { headers: options.headers });
    const requestAt = (address: string | undefined) =>
      client.execute(request).pipe(
        Effect.provideService(FetchHttpClient.RequestInit, requestInit),
        address === undefined
          ? (effect) => effect
          : Effect.provideService(
              FetchHttpClient.Fetch,
              Object.assign(pinnedFetch(address), { preconnect: globalThis.fetch.preconnect }),
            ),
        Effect.mapError((cause) => new UpstreamError({ operation: "outbound fetch", cause })),
      );

    // Each checked address in turn, as a name with several records would be tried; a failure on
    // the last one is the failure. A literal IP has no address to pin and goes as written.
    const targets = addresses.length > 0 ? addresses : [undefined];
    let response: HttpClientResponse.HttpClientResponse | undefined;
    for (const address of targets.slice(0, -1)) {
      const attempt = yield* Effect.exit(requestAt(address));
      if (Exit.isSuccess(attempt)) {
        response = attempt.value;
        break;
      }
    }
    response ??= yield* requestAt(targets.at(-1));

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
