import type { Elysia } from "elysia";
import { corsPlugin } from "@adapters/cors/plugin";
import { openapiPlugin } from "@adapters/openapi/plugin";
import { rateLimitPlugin } from "@adapters/rate-limit/plugin";
import { AppConfig } from "@config/env/service";
import type { AppRuntime } from "../runtime";
import { requestGuardPlugin } from "./request-guard";

/**
 * Global stack only (request guard, CORS, OpenAPI, rate limit), configured from the runtime's
 * `AppConfig`. Order: guard → CORS → docs → rate limit. Auth, DB, and request-id run on route
 * modules that need them.
 */
export function registerPlugins(app: Elysia, runtime: AppRuntime) {
  const config = runtime.runSync(AppConfig.useSync((value) => value));
  app.use(requestGuardPlugin);
  app.use(corsPlugin(config));
  if (config.OPENAPI_ENABLED) {
    app.use(openapiPlugin);
  }
  app.use(rateLimitPlugin(runtime));
}
