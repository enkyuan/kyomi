/**
 * Article route composition only.
 * Do not add route implementation here; add it to the focused route modules.
 */
import type { Elysia } from "elysia";
import { registerArticleEnrichmentRoutes } from "./reader/routes";
import { registerArticleReadRoutes } from "./read/routes";
import { registerArticleWriteRoutes } from "./write/routes";

export function registerArticleRoutes(app: Elysia) {
  let current = app;
  current = registerArticleReadRoutes(current) as unknown as Elysia;
  current = registerArticleEnrichmentRoutes(current) as unknown as Elysia;
  current = registerArticleWriteRoutes(current) as unknown as Elysia;
  return current;
}
