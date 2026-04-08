import { Elysia } from "elysia";
import { logger } from "@adapters/logger";
import { getRequestIdFromHeaders } from "@shared/utils/request-id";
import { elapsedMs } from "@shared/utils/timing";

const startedAtByRequest = new WeakMap<Request, number>();

/** Structured request start / complete logging (pairs with `request-id.middleware` on the same stack). */
export const loggingMiddleware = new Elysia({
  name: "logging.middleware",
})
  .decorate("logger", logger)
  .onRequest(({ request, logger: log }) => {
    startedAtByRequest.set(request, Date.now());
    const observedRequestId = getRequestIdFromHeaders(request.headers);
    log.info("request.started", {
      url: request.url,
      method: request.method,
      requestId: observedRequestId,
    });
  })
  .onAfterResponse(({ request, logger: log, set }) => {
    const observedRequestId = getRequestIdFromHeaders(request.headers);
    const startedAt = startedAtByRequest.get(request);
    log.info("request.completed", {
      url: request.url,
      method: request.method,
      status: set.status,
      requestId: observedRequestId,
      durationMs: startedAt ? elapsedMs(startedAt) : undefined,
    });
    startedAtByRequest.delete(request);
  });
