import type { AppError } from "@shared/errors/app";
import type { ErrorResponseDto } from "./response";

export function mapError(error: AppError, requestId?: string): ErrorResponseDto {
  return {
    error: {
      message: error.message,
      code: error.code,
      requestId,
      details: error.details,
    },
  };
}

export function mapErrorToResponse(error: AppError, requestId?: string) {
  return new Response(JSON.stringify(mapError(error, requestId)), {
    status: error.status,
    headers: { "content-type": "application/json" },
  });
}
