import { Layer, ManagedRuntime } from "effect";
import { registerErrorHandlers } from "@app/setup/errors";
import { requestIdMiddleware } from "@shared/http/request-id/middleware";
import { silentLogger, testConfig } from "./layers";

/**
 * `elysia` is a dependency of `apps/api`, not of `tests`, so test files cannot import it by name,
 * and resolving it with `require` yields a second copy of the package whose `ValidationError` is
 * not the class `registerErrorHandlers` checks with `instanceof`. Taking the class from a plugin
 * the API already built keeps one module instance for apps, handlers and error classes.
 *
 * Use it for a bare app to mount routes on (for example to derive an authenticated user before
 * the routes under test).
 */
export const Elysia =
  requestIdMiddleware.constructor as typeof import("../../../../apps/api/node_modules/elysia").Elysia;

/** The runtime `registerErrorHandlers` logs through in tests: the test config and a silent logger. */
const errorHandlerRuntime = ManagedRuntime.make(Layer.mergeAll(testConfig(), silentLogger));

/**
 * `registerErrorHandlers` for a test app. Route tests build their app from loosely typed Elysia
 * instances, so the app is taken as `unknown`.
 */
export function registerTestErrorHandlers(app: unknown) {
  registerErrorHandlers(app as Parameters<typeof registerErrorHandlers>[0], errorHandlerRuntime);
}
