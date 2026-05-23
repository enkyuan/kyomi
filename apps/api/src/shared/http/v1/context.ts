import type { db } from "@adapters/db/client";
import type { AppLogger } from "@adapters/logger";

/** Context for `/api/v1` handlers after `resolveSessionContext` + logging middleware. */
export type V1HandlerContext<
  TBody = unknown,
  TQuery = Record<string, unknown>,
  TParams = Record<string, string>,
> = {
  logger: AppLogger;
  userId: string;
  db: typeof db;
  set: { status?: number | string };
  params: TParams;
  query: TQuery;
  body: TBody;
};

type V1RuntimeContext = Partial<V1HandlerContext> & {
  params?: unknown;
  query?: unknown;
  body?: unknown;
};

function assertUserId(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("v1HandlerContext requires authenticated userId");
  }
}

function assertDb(value: unknown): asserts value is typeof db {
  if (!value) {
    throw new Error("v1HandlerContext requires database adapter");
  }
}

function coerceObject<T>(value: unknown, fallback: T): T {
  return (typeof value === "object" && value !== null ? value : fallback) as T;
}

function isLogger(value: unknown): value is AppLogger {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return (
    typeof Reflect.get(value, "info") === "function" &&
    typeof Reflect.get(value, "warn") === "function" &&
    typeof Reflect.get(value, "error") === "function"
  );
}

export function v1HandlerContext<
  TBody = unknown,
  TQuery = Record<string, unknown>,
  TParams = Record<string, string>,
>(context: unknown): V1HandlerContext<TBody, TQuery, TParams> {
  const c = context as V1RuntimeContext;
  if (!isLogger(c.logger)) {
    throw new Error("v1HandlerContext requires logger middleware");
  }
  assertUserId(c.userId);
  assertDb(c.db);

  return {
    logger: c.logger,
    userId: c.userId,
    db: c.db,
    set: coerceObject(c.set, {}),
    params: coerceObject(c.params, {} as TParams),
    query: coerceObject(c.query, {} as TQuery),
    body: c.body as TBody,
  };
}
