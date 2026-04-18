import type { Elysia } from "elysia";
import { registerArticleEnhancementRoutes } from "./articles.enhancements.routes";
import { registerArticleReadRoutes } from "./articles.read.routes";
import { registerArticleWriteRoutes } from "./articles.write.routes";

export function registerArticleRoutes(app: Elysia) {
  let current = app;
  current = registerArticleReadRoutes(current) as unknown as Elysia;
  current = registerArticleEnhancementRoutes(current) as unknown as Elysia;
  current = registerArticleWriteRoutes(current) as unknown as Elysia;
  return current;
}
