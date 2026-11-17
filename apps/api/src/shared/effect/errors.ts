import { Data } from "effect";
import { AppError } from "@shared/errors/app";

/**
 * The typed error catalogue for Effect code. One class per HTTP meaning, a stable `code` string per
 * failure (the same codes `AppError` sites use), and optional `details` for the wire envelope.
 * Status codes and default codes live in `ERROR_CATALOGUE` so the edge mapper stays exhaustive.
 */
type PublicFields = {
  readonly message: string;
  /** Stable machine code for the wire envelope; defaults to the class's catalogue code. */
  readonly code?: string;
  readonly details?: Record<string, unknown>;
  readonly cause?: unknown;
};

export class BadRequest extends Data.TaggedError("BadRequest")<PublicFields> {}
export class Unauthorized extends Data.TaggedError("Unauthorized")<PublicFields> {}
export class Forbidden extends Data.TaggedError("Forbidden")<PublicFields> {}
export class NotFound extends Data.TaggedError("NotFound")<PublicFields> {}
export class Conflict extends Data.TaggedError("Conflict")<PublicFields> {}
export class PayloadTooLarge extends Data.TaggedError("PayloadTooLarge")<PublicFields> {}
export class Unprocessable extends Data.TaggedError("Unprocessable")<PublicFields> {}
export class RateLimited extends Data.TaggedError("RateLimited")<PublicFields> {}
export class InternalError extends Data.TaggedError("InternalError")<PublicFields> {}
export class BadGateway extends Data.TaggedError("BadGateway")<PublicFields> {}
export class Unavailable extends Data.TaggedError("Unavailable")<PublicFields> {}
export class GatewayTimeout extends Data.TaggedError("GatewayTimeout")<PublicFields> {}

/** Errors whose `message` is safe to show to API clients. */
export type PublicError =
  | BadRequest
  | Unauthorized
  | Forbidden
  | NotFound
  | Conflict
  | PayloadTooLarge
  | Unprocessable
  | RateLimited
  | InternalError
  | BadGateway
  | Unavailable
  | GatewayTimeout;

type InfraFields = {
  /** What was being attempted, for logs (`"select 1"`, `"xpending"`). */
  readonly operation: string;
  readonly cause: unknown;
};

/** A Postgres/drizzle call failed. Rendered as an opaque 500; the cause is logged, not exposed. */
export class DatabaseError extends Data.TaggedError("DatabaseError")<InfraFields> {
  override get message() {
    return `Database operation failed: ${this.operation}`;
  }
}

/** A Redis call failed. `code` is the Redis error-reply code (`NOGROUP`, `WRONGTYPE`) when present. */
export class RedisError extends Data.TaggedError("RedisError")<
  InfraFields & { readonly code?: string }
> {
  override get message() {
    return `Redis operation failed: ${this.operation}${this.code ? ` (${this.code})` : ""}`;
  }
}

/** An outbound HTTP dependency failed. Rendered as an opaque 502. */
export class UpstreamError extends Data.TaggedError("UpstreamError")<InfraFields> {
  override get message() {
    return `Upstream request failed: ${this.operation}`;
  }
}

/** The environment failed validation while building the runtime. Never reaches a request. */
export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export type InfraError = DatabaseError | RedisError | UpstreamError | ConfigError;
export type ApiError = PublicError | InfraError;

type CatalogueEntry = { readonly status: number; readonly code: string; readonly expose: boolean };

/** Single source of truth for status + default code per error tag. */
export const ERROR_CATALOGUE = {
  BadRequest: { status: 400, code: "BAD_REQUEST", expose: true },
  Unauthorized: { status: 401, code: "UNAUTHORIZED", expose: true },
  Forbidden: { status: 403, code: "FORBIDDEN", expose: true },
  NotFound: { status: 404, code: "NOT_FOUND", expose: true },
  Conflict: { status: 409, code: "CONFLICT", expose: true },
  PayloadTooLarge: { status: 413, code: "PAYLOAD_TOO_LARGE", expose: true },
  Unprocessable: { status: 422, code: "VALIDATION_ERROR", expose: true },
  RateLimited: { status: 429, code: "RATE_LIMITED", expose: true },
  InternalError: { status: 500, code: "INTERNAL_ERROR", expose: true },
  BadGateway: { status: 502, code: "BAD_GATEWAY", expose: true },
  Unavailable: { status: 503, code: "SERVICE_UNAVAILABLE", expose: true },
  GatewayTimeout: { status: 504, code: "GATEWAY_TIMEOUT", expose: true },
  DatabaseError: { status: 500, code: "INTERNAL_ERROR", expose: false },
  RedisError: { status: 500, code: "INTERNAL_ERROR", expose: false },
  UpstreamError: { status: 502, code: "BAD_GATEWAY", expose: false },
  ConfigError: { status: 500, code: "INTERNAL_ERROR", expose: false },
} as const satisfies Record<ApiError["_tag"], CatalogueEntry>;

export function isApiError(value: unknown): value is ApiError {
  return (
    value instanceof Error &&
    "_tag" in value &&
    typeof value._tag === "string" &&
    Object.hasOwn(ERROR_CATALOGUE, value._tag)
  );
}

const PUBLIC_BY_STATUS: Record<number, new (fields: PublicFields) => PublicError> = {
  400: BadRequest,
  401: Unauthorized,
  403: Forbidden,
  404: NotFound,
  409: Conflict,
  413: PayloadTooLarge,
  422: Unprocessable,
  429: RateLimited,
  500: InternalError,
  502: BadGateway,
  503: Unavailable,
  504: GatewayTimeout,
};

/**
 * Interop for modules that have not moved yet: re-tag a legacy `AppError` by status, keeping its
 * code, message and details. Statuses outside the catalogue collapse to the nearest class.
 */
export function fromAppError(error: AppError): PublicError {
  const Class =
    PUBLIC_BY_STATUS[error.status] ?? (error.status >= 500 ? InternalError : BadRequest);
  return new Class({
    message: error.message,
    code: error.code,
    details: error.details,
    cause: error,
  });
}

/** What an unexpected throw from Promise code becomes: an opaque 500 carrying the cause. */
export function unexpected(cause: unknown): InternalError {
  return new InternalError({ message: "Internal error", cause });
}

/**
 * `catch` handler for `Effect.tryPromise` around legacy Promise code that may still throw
 * `AppError`: typed errors pass through, `AppError` is re-tagged, anything else is `unexpected`.
 * Classification is by class, never by message text.
 */
export function toPublicError(cause: unknown): PublicError {
  if (cause instanceof AppError) {
    return fromAppError(cause);
  }
  if (isApiError(cause) && ERROR_CATALOGUE[cause._tag].expose) {
    return cause as PublicError;
  }
  return unexpected(cause);
}
