import type { Elysia } from "elysia";
import type { ManagedRuntime } from "effect";
import type { Db } from "@adapters/db/service";
import { runEffect } from "@shared/http/effect/bridge";
import { v1EffectContext } from "@shared/http/v1/context";
import { inboxRecapQuerySchema, inboxRecapResponseSchema } from "./schemas";
import { getInboxRecap } from "./summary";

type RecapRuntime = ManagedRuntime.ManagedRuntime<Db, unknown>;

export function registerInboxRecapRoutes(app: Elysia, runtime: RecapRuntime) {
  return app.get(
    "/inbox/recap",
    (context) => {
      const { query, request, requestId, userId } = v1EffectContext<unknown, { limit?: string }>(
        context,
      );
      return runEffect({ runtime, request, requestId, userId }, getInboxRecap(userId, query.limit));
    },
    {
      query: inboxRecapQuerySchema,
      response: { 200: inboxRecapResponseSchema },
    },
  );
}
