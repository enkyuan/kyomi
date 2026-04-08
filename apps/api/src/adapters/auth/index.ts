/**
 * Authenticated route stack (Better Auth session in Postgres).
 * Apply on the **same** `Elysia` instance as your routes — do not nest a separate
 * pre-built `Elysia` for auth: Elysia 1.x will not merge `derive` context types into handlers.
 *
 * ```ts
 * .use(loggingMiddleware)
 * .derive(async ({ request, set }) => resolveSessionContext(request, set))
 * ```
 */
export { dbPlugin } from "../db/plugin";
export { loggingMiddleware } from "@shared/http/logging.middleware";
export { resolveSessionContext } from "@shared/http/session-context.middleware";
