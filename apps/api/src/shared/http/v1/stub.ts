import type { AppLogger } from "@adapters/logger";
import { t } from "elysia";

export const uuidParam = t.String({ format: "uuid" });

export const taskIdParam = t.String({ minLength: 1 });

export function notImplemented(
  set: { status?: number | string },
  logger: AppLogger,
  route: string,
  userId: string,
) {
  logger.warn("api.not_implemented", { route, userId });
  set.status = 501;
  return {
    code: "NOT_IMPLEMENTED" as const,
    message: "This endpoint is not implemented yet.",
    route,
  };
}
