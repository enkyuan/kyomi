import { Elysia } from "elysia";
import { authRoutes } from "@adapters/auth/routes";
import { readerAssetPlugin } from "@modules/articles/reader/assets/routes";
import { faviconPlugin } from "@modules/favicon/routes";
import { healthPlugin } from "@modules/health/routes";
import type { AppRuntime } from "../runtime";
import { createApiV1Router } from "./v1";

/** Root HTTP plugin: operational endpoints + versioned product API. */
export function createHttpRouter(runtime: AppRuntime) {
  return new Elysia({
    name: "kyomi.http",
  })
    .use(healthPlugin(runtime))
    .use(faviconPlugin(runtime))
    .use(readerAssetPlugin(runtime))
    .use(authRoutes(runtime))
    .use(createApiV1Router(runtime));
}

export function registerRoutes(app: Elysia, runtime: AppRuntime) {
  app.use(createHttpRouter(runtime));
}
