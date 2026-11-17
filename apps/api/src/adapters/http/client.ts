import { FetchHttpClient } from "effect/http";

/**
 * Outbound HTTP for Effect code is the `HttpClient` service from `effect/http`. This is its live
 * layer (global `fetch`). Tests replace the layer instead of patching `globalThis.fetch`. Requests
 * to untrusted URLs still go through the `shared/net` policy until that moves behind a service.
 */
export const HttpClientLive = FetchHttpClient.layer;
