import type { db } from "@adapters/db/client";
import type { AppLogger } from "@adapters/logger";

/** Context for `/api/v1` handlers after `resolveSessionContext` + logging middleware. */
export type V1HandlerContext = {
  logger: AppLogger;
  userId: string;
  db: typeof db;
  set: { status?: number | string };
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: unknown;
};

export function v1HandlerContext(context: unknown): V1HandlerContext {
  const c = context as Partial<V1HandlerContext> & { params?: Record<string, string> };
  return {
    logger: c.logger as AppLogger,
    userId: c.userId as string,
    db: c.db as typeof db,
    set: c.set ?? {},
    params: c.params ?? {},
    query:
      typeof c.query === "object" && c.query !== null ? (c.query as Record<string, unknown>) : {},
    body: c.body,
  };
}
