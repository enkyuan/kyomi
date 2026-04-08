import { Elysia } from "elysia";
import { registerErrorHandlers } from "./register-error-handlers";
import { registerLifecycle } from "./register-lifecycle";
import { registerPlugins } from "./register-plugins";
import { registerRoutes } from "./register-routes";

/**
 * HTTP API on Bun/Elysia — global plugins, lifecycle, errors, route tree.
 * global plugins → lifespan → exception handling → router tree.
 */
export function createApp() {
  const app = new Elysia({
    name: "@cronos/api",
  });

  registerPlugins(app);
  registerLifecycle(app);
  registerErrorHandlers(app);
  registerRoutes(app);

  return app;
}
