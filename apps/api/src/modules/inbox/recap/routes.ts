import type { Elysia } from "elysia";
import { v1HandlerContext } from "@shared/http/v1/context";
import {
  inboxRecapQuerySchema,
  inboxRecapResponseSchema,
} from "./schemas";
import { getInboxRecap } from "./service";

export function registerInboxRecapRoutes(app: Elysia) {
  const handler = async (context: unknown) => {
    const { db, query, userId } = v1HandlerContext<unknown, { limit?: string }>(context);
    return getInboxRecap(db, userId, query.limit);
  };

  return app.get("/inbox/recap", handler, {
    query: inboxRecapQuerySchema,
    response: { 200: inboxRecapResponseSchema },
  });
}
