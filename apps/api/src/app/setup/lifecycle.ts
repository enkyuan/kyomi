import type { Elysia } from "elysia";
import { assertDevelopmentDatabaseSchemaReady } from "@adapters/db/guard";
import { env } from "@config/env";
import { shutdownAdapters } from "@adapters/shutdown";
import { logger } from "@adapters/logger";
import type { AppRuntime } from "../runtime";
import { parseFeedAdminUserIds } from "@modules/feeds/admin/allowlist";

/**
 * Startup / shutdown hooks (FastAPI `lifespan` equivalent).
 */
export function registerLifecycle(
  app: Elysia,
  options: { runtime: AppRuntime; ownsRuntime: boolean },
) {
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
    // Legacy singletons first, then every Layer-owned resource (pool, Redis) in reverse acquire order.
    await shutdownAdapters();
    if (options.ownsRuntime) {
      await options.runtime.dispose();
    }
    logger.info("application.shutdown.complete", { nodeEnv: env.NODE_ENV });
  });
}
