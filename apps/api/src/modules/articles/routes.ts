/**
 * Article route composition only.
 * Do not add route implementation here; add it to the focused route modules.
 */
import type { Elysia } from "elysia";
import type { ManagedRuntime } from "effect";
import type { Db } from "@adapters/db/service";
import type { AppLogger } from "@adapters/logger/service";
import type { JobQueue } from "@adapters/queue/service";
import type { AppConfig } from "@config/env/service";
import { registerArticleProgressRoutes } from "./progress/routes";
import { registerArticleEnrichmentRoutes } from "./reader/routes";
import { registerArticleReadRoutes } from "./read/routes";
import { registerArticleResurfaceRoutes } from "./resurface/routes";
import { registerArticleWriteRoutes } from "./write/routes";

/** The services the article routes that have moved to Effect run against. */
type ArticleRuntime = ManagedRuntime.ManagedRuntime<Db | AppLogger | AppConfig | JobQueue, unknown>;

export function registerArticleRoutes(app: Elysia, runtime: ArticleRuntime) {
  let current = app;
  current = registerArticleReadRoutes(current, runtime) as unknown as Elysia;
  current = registerArticleEnrichmentRoutes(current, runtime) as unknown as Elysia;
  current = registerArticleWriteRoutes(current, runtime) as unknown as Elysia;
  current = registerArticleProgressRoutes(current, runtime) as unknown as Elysia;
  current = registerArticleResurfaceRoutes(current, runtime) as unknown as Elysia;
  return current;
}
