type V1RuntimeContext = {
  userId?: unknown;
  set?: unknown;
  params?: unknown;
  query?: unknown;
  body?: unknown;
};

function assertUserId(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("v1EffectContext requires authenticated userId");
  }
}

function coerceObject<T>(value: unknown, fallback: T): T {
  return (typeof value === "object" && value !== null ? value : fallback) as T;
}

/** Context for `/api/v1` handlers that run an Effect: what `runEffect` needs plus request input. */
export type V1EffectContext<
  TBody = unknown,
  TQuery = Record<string, unknown>,
  TParams = Record<string, string>,
> = {
  request: Request;
  requestId: string;
  userId: string;
  set: { status?: number | string };
  params: TParams;
  query: TQuery;
  body: TBody;
};

/**
 * Reads the request, request id and authenticated user that `resolveSessionContext` derived. Effect
 * code gets the database and logger from the runtime's services, not from the context.
 */
export function v1EffectContext<
  TBody = unknown,
  TQuery = Record<string, unknown>,
  TParams = Record<string, string>,
>(context: unknown): V1EffectContext<TBody, TQuery, TParams> {
  const c = context as V1RuntimeContext & { request?: unknown; requestId?: unknown };
  assertUserId(c.userId);
  if (!(c.request instanceof Request)) {
    throw new Error("v1EffectContext requires the request");
  }
  if (typeof c.requestId !== "string" || c.requestId.length === 0) {
    throw new Error("v1EffectContext requires a request id");
  }
  return {
    request: c.request,
    requestId: c.requestId,
    userId: c.userId,
    set: coerceObject(c.set, {}),
    params: coerceObject(c.params, {} as TParams),
    query: coerceObject(c.query, {} as TQuery),
    body: c.body as TBody,
  };
}
