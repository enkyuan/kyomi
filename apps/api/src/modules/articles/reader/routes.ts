import type { Elysia } from "elysia";
import { v1HandlerContext } from "@shared/http/v1/context";
import { extractFullTextForUser } from "./full-text";
import { articleIdParamsSchema, extractFullTextResponseSchema } from "../schemas";

export function registerArticleEnrichmentRoutes(app: Elysia) {
  return app.post(
    "/articles/:articleId/extract-full-text",
    async (context) => {
      const { db, logger, params, userId } = v1HandlerContext(context);
      const result = await extractFullTextForUser(db, userId, params.articleId);
      if (result.ok) {
        logger.info("articles.extract_full_text.succeeded", {
          userId,
          articleId: params.articleId,
        });
      } else {
        logger.warn("articles.extract_full_text.failed", {
          userId,
          articleId: params.articleId,
          errorCode: result.errorCode,
        });
      }
      return result;
    },
    {
      params: articleIdParamsSchema,
      response: { 200: extractFullTextResponseSchema },
    },
  );
}
