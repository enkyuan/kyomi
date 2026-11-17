import { Cause, Result } from "effect";
import { ERROR_CATALOGUE, isApiError } from "@shared/effect/errors";
import type { ErrorResponseDto } from "./response";

/** A failure ready to render as `{ error: { message, code, requestId, details } }`. */
export type RenderedFailure = {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  /** The original error or defect, for logging. */
  readonly cause: unknown;
  /** True for typed failures the client can act on; false for defects and opaque infra errors. */
  readonly expected: boolean;
};

/** Thrown by the HTTP bridge so Elysia's `onError` renders an Effect failure through `describeError`. */
export class EffectFailure extends Error {
  readonly rendered: RenderedFailure;

  constructor(rendered: RenderedFailure) {
    super(rendered.message, { cause: rendered.cause });
    this.name = "EffectFailure";
    this.rendered = rendered;
  }
}

const INTERNAL: Pick<RenderedFailure, "status" | "code" | "message"> = {
  status: 500,
  code: "INTERNAL_ERROR",
  message: "Internal error",
};

function isClientHttpError(
  error: unknown,
): error is { status: number; message?: string; code?: unknown } {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const status = Reflect.get(error, "status");
  return typeof status === "number" && status >= 400 && status < 500;
}

/**
 * The one mapping from any thrown or failed value to a status and error body. Typed catalogue
 * errors use `ERROR_CATALOGUE`, framework 4xx errors keep their status, and everything else is an opaque 500.
 */
export function describeError(error: unknown): RenderedFailure {
  if (error instanceof EffectFailure) {
    return error.rendered;
  }
  if (isApiError(error)) {
    const entry = ERROR_CATALOGUE[error._tag];
    const fields = error as { message?: string; code?: string; details?: Record<string, unknown> };
    return {
      status: entry.status,
      code: entry.expose && typeof fields.code === "string" ? fields.code : entry.code,
      message: entry.expose && fields.message ? fields.message : INTERNAL.message,
      details: entry.expose ? fields.details : undefined,
      cause: error,
      expected: entry.expose,
    };
  }
  if (isClientHttpError(error)) {
    return {
      status: error.status,
      code: typeof error.code === "string" ? error.code : "BAD_REQUEST",
      message: error.message ?? "Bad request",
      cause: error,
      expected: true,
    };
  }
  return { ...INTERNAL, cause: error, expected: false };
}

/**
 * Render a whole `Cause`: the first typed failure wins, then the first defect, then interruption.
 * `aborted` marks a request the client abandoned (HTTP 499) as opposed to a server-side stop (503).
 */
export function describeCause(cause: Cause.Cause<unknown>, aborted = false): RenderedFailure {
  const failure = Cause.findError(cause);
  if (Result.isSuccess(failure)) {
    return describeError(failure.success);
  }
  const defect = Cause.findDefect(cause);
  if (Result.isSuccess(defect)) {
    return describeError(defect.success);
  }
  if (Cause.hasInterrupts(cause)) {
    return aborted
      ? {
          status: 499,
          code: "CLIENT_CLOSED_REQUEST",
          message: "Request aborted",
          cause,
          expected: true,
        }
      : {
          status: 503,
          code: "REQUEST_INTERRUPTED",
          message: "Request interrupted",
          cause,
          expected: true,
        };
  }
  return { ...INTERNAL, cause, expected: false };
}

export function failureBody(rendered: RenderedFailure, requestId?: string): ErrorResponseDto {
  return {
    error: {
      message: rendered.message,
      code: rendered.code,
      requestId,
      details: rendered.details,
    },
  };
}

export function failureResponse(rendered: RenderedFailure, requestId?: string): Response {
  return new Response(JSON.stringify(failureBody(rendered, requestId)), {
    status: rendered.status,
    headers: { "content-type": "application/json" },
  });
}
