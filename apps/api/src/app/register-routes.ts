import { Elysia } from "elysia";
import { healthPlugin } from "@modules/health/health.routes";
import { apiV1Router } from "./api-v1.router";

/** Root HTTP plugin: operational endpoints + versioned product API. */
export const httpRouter = new Elysia({
  name: "cronos.http",
})
  .use(healthPlugin)
  .use(apiV1Router);

export function registerRoutes(app: Elysia) {
  app.use(httpRouter);
}
