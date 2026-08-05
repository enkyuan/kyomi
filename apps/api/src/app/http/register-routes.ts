import { Elysia } from "elysia";
import { authRoutes } from "@adapters/auth/routes";
import { readerAssetPlugin } from "@modules/articles/reader/assets/routes";
import { faviconPlugin } from "@modules/favicon/routes";
import { healthPlugin } from "@modules/health/routes";
import { apiV1Router } from "./v1-router";

/** Root HTTP plugin: operational endpoints + versioned product API. */
export const httpRouter = new Elysia({
  name: "kyomi.http",
})
  .use(healthPlugin)
  .use(faviconPlugin)
  .use(readerAssetPlugin)
  .use(authRoutes)
  .use(apiV1Router);

export function registerRoutes(app: Elysia) {
  app.use(httpRouter);
}
