import type { Elysia } from "elysia";
import { enforceRateLimitForContext } from "@adapters/rate-limit/plugin";
import { v1HandlerContext } from "@shared/http/v1/context";
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

export function registerArticleResurfaceRoutes(app: Elysia) {
  return app
    .get(
      "/articles/views/continue-reading",
      async (context) => {
        const { db, query, userId } = v1HandlerContext<unknown, { limit?: string }>(context);
        return listContinueReading(db, userId, normalizeContinueReadingLimit(query.limit));
      },
      {
        query: continueReadingQuerySchema,
        response: { 200: cursorListResponseSchema },
      },
    )
    .post(
      "/articles/views/continue-reading/impressions",
      async (context) => {
        const { body, db, userId } = v1HandlerContext<{ articleIds: string[] }>(context);
        await enforceRateLimitForContext(context, userId, continueReadingImpressionsRateLimit);
        await recordContinueReadingImpressions(db, userId, body.articleIds);
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
        const { db, params, userId } = v1HandlerContext<
          unknown,
          Record<string, unknown>,
          { articleId: string }
        >(context);
        await enforceRateLimitForContext(context, userId, continueReadingDismissRateLimit);
        await dismissContinueReading(db, userId, params.articleId);
        return { message: "Article dismissed from continue reading" };
      },
      {
        params: articleIdParamsSchema,
        response: { 200: messageResponseSchema },
      },
    );
}
