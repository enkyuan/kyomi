/**
 * Carries the HTTP status of a failed document request into the router. Only the server entry sets
 * it, on the request it re-renders through the error page; incoming requests have it stripped.
 */
export const STATUS_ERROR_HEADER = "x-kyomi-error-status";

/** An error that knows its HTTP status. Serialization keeps `status`, so it survives server functions. */
export class HttpStatusError extends Error {
  readonly status: number;

  constructor(status: number, message = `HTTP ${status}`) {
    super(message);
    this.name = "HttpStatusError";
    this.status = status;
  }
}

/** The value as an HTTP error status (4xx or 5xx), or `undefined` for anything else. */
export function toErrorStatus(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 400 && value <= 599
    ? value
    : undefined;
}

/** The HTTP status an error carries: not-found, a thrown `Response`, or a `status`/`statusCode` field. */
export function getErrorStatus(error: unknown) {
  if (error instanceof Response) {
    return toErrorStatus(error.status);
  }
  if (error && typeof error === "object") {
    const { isNotFound, status, statusCode } = error as {
      isNotFound?: unknown;
      status?: unknown;
      statusCode?: unknown;
    };
    // The router marks the `notFound()` it throws this way.
    if (isNotFound === true) {
      return 404;
    }
    return toErrorStatus(status) ?? toErrorStatus(statusCode);
  }
  return undefined;
}
