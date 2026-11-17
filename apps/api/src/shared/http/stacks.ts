import { Elysia } from "elysia";
import type { ManagedRuntime } from "effect";
import { AppConfig } from "@config/env/service";
import { loggingMiddleware } from "@shared/http/logging/middleware";
import { requestIdMiddleware } from "@shared/http/request-id/middleware";

function buildRequestObservationPlugin(runtime: ManagedRuntime.ManagedRuntime<AppConfig, unknown>) {
  const config = runtime.runSync(AppConfig.useSync((value) => value));
  return new Elysia({ name: "kyomi.http.observation" })
    .use(requestIdMiddleware)
    .use(loggingMiddleware(config));
}

const byRuntime = new WeakMap<object, ReturnType<typeof buildRequestObservationPlugin>>();

/**
 * Request correlation id + structured access logging, configured from the runtime's `AppConfig`.
 * Persistence is not part of it: Effect code gets Postgres and Redis from the runtime's services.
 *
 * One instance per runtime: every route group mounts the same plugin object, which is what lets
 * Elysia deduplicate it (a fresh instance per group re-registers the logger and never finishes).
 */
export function requestObservationPlugin(
  runtime: ManagedRuntime.ManagedRuntime<AppConfig, unknown>,
) {
  let plugin = byRuntime.get(runtime);
  if (!plugin) {
    plugin = buildRequestObservationPlugin(runtime);
    byRuntime.set(runtime, plugin);
  }
  return plugin;
}
