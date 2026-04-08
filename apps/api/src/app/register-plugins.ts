import type { Elysia } from "elysia";
import { corsPlugin } from "@adapters/cors/cors.plugin";
import { openapiPlugin } from "@adapters/openapi/openapi.plugin";
import { rateLimitPlugin } from "@adapters/rate-limit/rate-limit.plugin";

/**
 * Global stack only (CORS, OpenAPI, rate limit).
 * Order: CORS → docs → rate limit. Auth, DB, and request-id run on route modules that need them.
 */
export function registerPlugins(app: Elysia) {
  app.use(corsPlugin);
  app.use(openapiPlugin);
  app.use(rateLimitPlugin);
}
