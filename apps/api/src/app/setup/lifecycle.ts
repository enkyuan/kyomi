import { Effect } from "effect";
import type { Elysia } from "elysia";
import { developmentSchemaReady } from "@adapters/db/guard";
import { AppLogger } from "@adapters/logger/service";
import { AppConfig } from "@config/env/service";
import { parseFeedAdminUserIds } from "@modules/feeds/admin/allowlist";
import type { AppRuntime } from "../runtime";

const startup = Effect.gen(function* () {
  const config = yield* AppConfig;
  const log = yield* AppLogger;
  yield* developmentSchemaReady;

  yield* log.info("application.startup.complete", { nodeEnv: config.NODE_ENV });
  if (
    parseFeedAdminUserIds(config.FEED_ADMIN_USER_IDS).length === 0 &&
    !config.FEED_ADMIN_SHARED_SECRET
  ) {
    yield* log.warn("feed.admin.unconfigured", { nodeEnv: config.NODE_ENV });
  }
});

const shutdown = Effect.gen(function* () {
  const config = yield* AppConfig;
  const log = yield* AppLogger;
  yield* log.info("application.shutdown.complete", { nodeEnv: config.NODE_ENV });
});

/**
 * Startup / shutdown hooks (FastAPI `lifespan` equivalent). Resources are owned by the runtime's
 * Layers; an app that created its own runtime disposes it here. Elysia does not await `onStop`, so
 * a process entrypoint that must finish shutdown before exiting owns the runtime and disposes it.
 */
export function registerLifecycle(
  app: Elysia,
  options: { runtime: AppRuntime; ownsRuntime: boolean },
) {
  app.onStart(() => options.runtime.runPromise(startup));

  app.onStop(async () => {
    await options.runtime.runPromise(shutdown);
    if (options.ownsRuntime) {
      await options.runtime.dispose();
    }
  });
}
