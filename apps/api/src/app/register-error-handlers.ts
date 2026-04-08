import type { Elysia } from "elysia";
import { ValidationError } from "elysia";
import { env } from "@config/env";
import { logger } from "@adapters/logger";
import { AppError } from "@shared/errors/app-error";
import { shapeErrorResponse } from "@shared/http/error-shape.middleware";
import { getRequestIdFromHeaders } from "@shared/utils/request-id";

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

export function registerErrorHandlers(app: Elysia) {
  app.onError(({ error, request, set, code }) => {
    const requestId = resolveErrorRequestId(request, set);

    if (code === "VALIDATION" && error instanceof ValidationError) {
      logger.warn("request.validation.failed", {
        path: new URL(request.url).pathname,
        method: request.method,
        requestId,
      });
      return validationFailureResponse(error, requestId);
    }

    const isAppError = error instanceof AppError;
    const context = {
      url: request.url,
      method: request.method,
      requestId,
      error: error instanceof Error ? error.message : "Unknown error",
      errorCode: isAppError ? error.code : undefined,
      errorDetails: isAppError ? error.details : undefined,
      stack: env.NODE_ENV === "development" && error instanceof Error ? error.stack : undefined,
    };

    logger.error("request.failed", context);

    return shapeErrorResponse(error, requestId);
  });
}
