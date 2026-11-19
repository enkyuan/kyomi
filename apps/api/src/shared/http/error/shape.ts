import { describeError, failureResponse } from "./render";

export function shapeErrorResponse(error: unknown, requestId?: string) {
  if (error instanceof Response) {
    return error;
  }
  return failureResponse(describeError(error), requestId);
}
