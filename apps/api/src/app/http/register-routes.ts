import { Elysia } from "elysia";
import { authRoutes } from "@adapters/auth/routes";
import { faviconPlugin } from "@modules/favicon/routes";
import { healthPlugin } from "@modules/health/routes";
import { v1Router } from "./v1-router";

/** Root HTTP plugin: operational endpoints + versioned product API. */
export const httpRouter = new Elysia({
  name: "kyomi.http",
})
  .use(healthPlugin)
  .use(faviconPlugin)
  .use(authRoutes)
  .use(v1Router);

export function registerRoutes(app: Elysia) {
  app.use(httpRouter);
}
