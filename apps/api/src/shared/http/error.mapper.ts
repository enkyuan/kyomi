import type { AppError } from "@shared/errors/app-error";
import type { ErrorResponseDto } from "@shared/http/error-response.dto";

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
