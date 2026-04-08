import type { Elysia } from "elysia";
import { env } from "@config/env";
import { shutdownAdapters } from "@adapters/lifecycle";
import { logger } from "@adapters/logger";

/**
 * Startup / shutdown hooks (FastAPI `lifespan` equivalent).
 */
export function registerLifecycle(app: Elysia) {
  app.onStart(() => {
    logger.info("application.startup.complete", { nodeEnv: env.NODE_ENV });
  });

  app.onStop(async () => {
    await shutdownAdapters();
    logger.info("application.shutdown.complete", { nodeEnv: env.NODE_ENV });
  });
}
