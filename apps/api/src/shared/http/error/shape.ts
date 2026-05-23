import { AppError } from "@shared/errors/app";
import { mapErrorToResponse } from "./map";

export function shapeErrorResponse(error: unknown, requestId?: string) {
  if (error instanceof Response) {
    return error;
  }

  if (error instanceof AppError) {
    return mapErrorToResponse(error, requestId);
  }

  if (isHttpError(error)) {
    return mapErrorToResponse(
      new AppError(error.message ?? "Bad request", {
        status: error.status,
        code: typeof error.code === "string" ? error.code : "BAD_REQUEST",
      }),
      requestId,
    );
  }

  return mapErrorToResponse(new AppError("Internal error"), requestId);
}

function isHttpError(
  error: unknown,
): error is { status: number; message?: string; code?: unknown } {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const status = Reflect.get(error, "status");
  return typeof status === "number" && status >= 400 && status < 500;
}
