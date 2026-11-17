import type { ManagedRuntime } from "effect";
import type { Elysia } from "elysia";
import { ValidationError } from "elysia";
import { AppLogger } from "@adapters/logger/service";
import { AppConfig } from "@config/env/service";
import { serializeError } from "@shared/errors/serialize";
import { describeError } from "@shared/http/error/render";
import { shapeErrorResponse } from "@shared/http/error/shape";
import { getRequestIdFromHeaders } from "@shared/http/request-id/headers";

function resolveErrorRequestId(
  request: Request,
  set: { headers: Record<string, string | number | undefined> },
) {
  const fromSet = set.headers["x-request-id"];
  if (typeof fromSet === "string" && fromSet.length > 0) {
    return fromSet;
  }
  return getRequestIdFromHeaders(request.headers);
}

function validationFailureResponse(error: ValidationError, requestId: string) {
  return new Response(
    JSON.stringify({
      error: {
        message: error.message,
        code: "VALIDATION_ERROR",
        requestId,
        details: { issues: error.all },
      },
    }),
    {
      status: 422,
      headers: { "content-type": "application/json" },
    },
  );
}

/**
 * Renders every failure as the wire envelope and logs it. The logger and the development stack
 * flag come from the runtime's services; Elysia hooks are synchronous, so the log Effect runs
 * with `runSync` (the sink writes synchronously).
 */
export function registerErrorHandlers(
  app: Elysia,
  runtime: ManagedRuntime.ManagedRuntime<AppLogger | AppConfig, unknown>,
) {
  const { NODE_ENV } = runtime.runSync(AppConfig.useSync((value) => value));
  const log = (level: "warn" | "error", event: string, context: Record<string, unknown>) =>
    runtime.runSync(AppLogger.use((logger) => logger[level](event, context)));

  app.onError(({ error, request, set, code }) => {
    const requestId = resolveErrorRequestId(request, set);

    if (code === "VALIDATION" && error instanceof ValidationError) {
      log("warn", "request.validation.failed", {
        path: new URL(request.url).pathname,
        method: request.method,
        requestId,
      });
      return validationFailureResponse(error, requestId);
    }

    const rendered = describeError(error);
    const context = {
      path: new URL(request.url).pathname,
      method: request.method,
      requestId,
      error: error instanceof Error ? error.message : "Unknown error",
      errorCode: rendered.expected ? rendered.code : undefined,
      errorDetails: rendered.details,
      cause: rendered.expected ? undefined : serializeError(rendered.cause),
      stack: NODE_ENV === "development" && error instanceof Error ? error.stack : undefined,
    };

    log("error", "request.failed", context);

    return shapeErrorResponse(error, requestId);
  });
}
