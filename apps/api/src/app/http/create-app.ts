import { Elysia } from "elysia";
import { registerErrorHandlers } from "../setup/register-error-handlers";
import { registerLifecycle } from "../setup/register-lifecycle";
import { registerPlugins } from "../setup/register-plugins";
import { registerRoutes } from "./register-routes";

/**
 * HTTP API on Bun/Elysia — global plugins, lifecycle, errors, route tree.
 * global plugins → lifespan → exception handling → router tree.
 */
export function createApp() {
  const app = new Elysia({
    name: "@vols.rss/api",
  });

  registerPlugins(app);
  registerLifecycle(app);
  registerErrorHandlers(app);
  registerRoutes(app);

  return app;
}
