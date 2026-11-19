import type { Effect, ManagedRuntime } from "effect";
import type { Elysia } from "elysia";
import type { Db } from "@adapters/db/service";
import type { AppConfig } from "@config/env/service";
import { enforceRateLimitForContext } from "@adapters/rate-limit/plugin";
import type { CurrentUser, RequestContext } from "@shared/effect/request";
import { runEffect } from "@shared/http/effect/bridge";
import { v1EffectContext, type V1EffectContext } from "@shared/http/v1/context";
import { articleIdParamsSchema, cursorListResponseSchema, messageResponseSchema } from "../schemas";
import {
  dismissContinueReading,
  listContinueReading,
  normalizeContinueReadingLimit,
  recordContinueReadingImpressions,
} from "./operations";
import {
  continueReadingDismissRateLimit,
  continueReadingImpressionsBodySchema,
  continueReadingImpressionsRateLimit,
  continueReadingQuerySchema,
} from "./schemas";

type ResurfaceRuntime = ManagedRuntime.ManagedRuntime<Db | AppConfig, unknown>;

export function registerArticleResurfaceRoutes(app: Elysia, runtime: ResurfaceRuntime) {
  /** Run an operation for the authenticated user of this request. */
  const run = <A, E>(
    input: V1EffectContext<unknown, unknown, unknown>,
    effect: Effect.Effect<A, E, Db | AppConfig | RequestContext | CurrentUser>,
  ) =>
    runEffect(
      { runtime, request: input.request, requestId: input.requestId, userId: input.userId },
      effect,
    );

  return app
    .get(
      "/articles/views/continue-reading",
      (context) => {
        const input = v1EffectContext<unknown, { limit?: string }>(context);
        return run(input, listContinueReading(normalizeContinueReadingLimit(input.query.limit)));
      },
      {
        query: continueReadingQuerySchema,
        response: { 200: cursorListResponseSchema },
      },
    )
    .post(
      "/articles/views/continue-reading/impressions",
      async (context) => {
        const input = v1EffectContext<{ articleIds: string[] }>(context);
        await enforceRateLimitForContext(
          context,
          input.userId,
          continueReadingImpressionsRateLimit,
        );
        await run(input, recordContinueReadingImpressions(input.body.articleIds));
        return { message: "Impressions recorded" };
      },
      {
        body: continueReadingImpressionsBodySchema,
        response: { 200: messageResponseSchema },
      },
    )
    .post(
      "/articles/:articleId/continue-reading/dismiss",
      async (context) => {
        const input = v1EffectContext<unknown, Record<string, unknown>, { articleId: string }>(
          context,
        );
        await enforceRateLimitForContext(context, input.userId, continueReadingDismissRateLimit);
        await run(input, dismissContinueReading(input.params.articleId));
        return { message: "Article dismissed from continue reading" };
      },
      {
        params: articleIdParamsSchema,
        response: { 200: messageResponseSchema },
      },
    );
}
