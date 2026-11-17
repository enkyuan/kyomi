import { Elysia } from "elysia";
import { registerErrorHandlers } from "../setup/errors";
import { registerLifecycle } from "../setup/lifecycle";
import { registerPlugins } from "../setup/plugins";
import { createAppRuntime, type AppRuntime } from "../runtime";
import { registerRoutes } from "./router";

/**
 * HTTP API on Bun/Elysia — global plugins, lifecycle, errors, route tree.
 * global plugins → lifespan → exception handling → router tree.
 *
 * The Effect runtime is created here unless the caller passes one (tests pass a runtime built from
 * test layers and dispose it themselves). An owned runtime is disposed when the server stops.
 */
export function createApp(options: { runtime?: AppRuntime } = {}) {
  const runtime = options.runtime ?? createAppRuntime();
  const app = new Elysia({
    name: "@kyomi/api",
  });

  registerPlugins(app);
  registerLifecycle(app, { runtime, ownsRuntime: options.runtime === undefined });
  registerErrorHandlers(app);
  registerRoutes(app, runtime);

  return app;
}
