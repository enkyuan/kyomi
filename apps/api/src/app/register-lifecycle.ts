import type { Elysia } from "elysia";
import { assertDevelopmentDatabaseSchemaReady } from "@adapters/db/startup-schema-guard";
import { env } from "@config/env";
import { shutdownAdapters } from "@adapters/lifecycle";
import { logger } from "@adapters/logger";
import { parseFeedAdminUserIds } from "@modules/feeds/feeds.admin-allowlist";

/**
 * Startup / shutdown hooks (FastAPI `lifespan` equivalent).
 */
export function registerLifecycle(app: Elysia) {
  app.onStart(async () => {
    if (env.NODE_ENV === "development") {
      await assertDevelopmentDatabaseSchemaReady();
    }

    logger.info("application.startup.complete", { nodeEnv: env.NODE_ENV });
    if (
      parseFeedAdminUserIds(env.FEED_ADMIN_USER_IDS).length === 0 &&
      !env.FEED_ADMIN_SHARED_SECRET
    ) {
      logger.warn("feed.admin.unconfigured", { nodeEnv: env.NODE_ENV });
    }
  });

  app.onStop(async () => {
    await shutdownAdapters();
    logger.info("application.shutdown.complete", { nodeEnv: env.NODE_ENV });
  });
}
