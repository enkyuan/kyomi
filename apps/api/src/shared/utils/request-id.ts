import { createRequestId } from "./ids";

/** Matches Elysia `set.headers` (string or numeric values allowed). */
export type MutableResponseHeaders = Record<string, string | number | undefined>;

export function propagateOrMintRequestId(
  request: Request,
  set: { headers: MutableResponseHeaders },
) {
  const requestId = request.headers.get("x-request-id") ?? createRequestId();
  set.headers["x-request-id"] = requestId;
  return requestId;
}

export function getRequestIdFromHeaders(headers: Headers) {
  return headers.get("x-request-id") ?? "unknown";
}
