import { Context, Effect, Layer } from "effect";
import {
  resolvePersistedFaviconHost,
  tryFetchImageIfHostSafe,
  type FaviconHostStore,
  type PersistedFaviconHostResult,
} from "@kyomi/ingest/favicon";
import { DatabaseError } from "@shared/effect/errors";

export type FaviconResolverShape = {
  /**
   * The cached or freshly resolved favicon for an origin, or null when the origin is invalid.
   * Reads and writes the host cache through `store`; only a store failure can fail it, because
   * ingest turns every network failure into a cached miss.
   */
  readonly resolveHost: (
    store: FaviconHostStore,
    origin: string,
    options?: { forceRefresh?: boolean },
  ) => Effect.Effect<PersistedFaviconHostResult | null, DatabaseError>;
  /**
   * Fetch an image from a host that passes the outbound-safety check, following redirects with the
   * same check on every hop. Null when the host is unsafe or the response is not an image.
   */
  readonly fetchImage: (url: string) => Effect.Effect<Response | null>;
};

/**
 * The favicon resolver from `@kyomi/ingest`, which does its own DNS, redirect and size policing
 * with the global `fetch`. The live layer wraps it once; tests swap the layer instead of patching
 * `fetch`.
 */
export class FaviconResolver extends Context.Service<FaviconResolver, FaviconResolverShape>()(
  "kyomi/FaviconResolver",
) {
  static readonly layer = Layer.succeed(
    FaviconResolver,
    FaviconResolver.of({
      resolveHost: (store, origin, options) =>
        Effect.tryPromise({
          try: () => resolvePersistedFaviconHost(store, origin, options),
          catch: (cause) => new DatabaseError({ operation: "favicon.resolve_host", cause }),
        }),
      fetchImage: (url) => Effect.promise(() => tryFetchImageIfHostSafe(url)),
    }),
  );
}
