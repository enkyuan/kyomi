import type { Elysia } from "elysia";
import { corsPlugin } from "@adapters/cors/plugin";
import { openapiPlugin } from "@adapters/openapi/plugin";
import { rateLimitPlugin } from "@adapters/rate-limit/plugin";
import { env } from "@config/env";

/**
 * Global stack only (CORS, OpenAPI, rate limit).
 * Order: CORS → docs → rate limit. Auth, DB, and request-id run on route modules that need them.
 */
export function registerPlugins(app: Elysia) {
  app.use(corsPlugin);
  if (env.OPENAPI_ENABLED) {
    app.use(openapiPlugin);
  }
  app.use(rateLimitPlugin);
}
