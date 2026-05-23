import type { Elysia } from "elysia";
import { v1HandlerContext } from "@shared/http/v1/context";
import { getArticleDetailForUser } from "../read/detail";
import { resolveEnhancementContent, summarizeContent, translateContent } from "./enrichment";
import { extractFullTextForUser } from "./extract-full-text";
import {
  articleIdParamsSchema,
  extractFullTextResponseSchema,
  summarizeBodySchema,
  summarizeResponseSchema,
  translateBodySchema,
  translateResponseSchema,
} from "../schemas";

export function registerArticleEnrichmentRoutes(app: Elysia) {
  return app
    .post(
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
    )
    .post(
      "/articles/:articleId/summarize",
      async (context) => {
        const { body, db, logger, params, userId } = v1HandlerContext<
          { content?: string; language_key?: string },
          Record<string, unknown>,
          { articleId: string }
        >(context);
        const article = await getArticleDetailForUser(db, userId, params.articleId);
        const content = resolveEnhancementContent(body.content, article);
        const summary = summarizeContent(content, body.language_key);
        logger.info("articles.summarize.succeeded", { userId, articleId: params.articleId });
        return { summary };
      },
      {
        params: articleIdParamsSchema,
        body: summarizeBodySchema,
        response: { 200: summarizeResponseSchema },
      },
    )
    .post(
      "/articles/:articleId/translate",
      async (context) => {
        const { body, db, logger, params, userId } = v1HandlerContext<
          { content?: string; target_language: string },
          Record<string, unknown>,
          { articleId: string }
        >(context);
        const article = await getArticleDetailForUser(db, userId, params.articleId);
        const targetLanguage = body.target_language;
        const content = resolveEnhancementContent(body.content, article);
        const translated = translateContent(content, targetLanguage);
        logger.info("articles.translate.succeeded", {
          userId,
          articleId: params.articleId,
          targetLanguage,
        });
        return {
          translated_content: translated,
          target_language: targetLanguage,
        };
      },
      {
        params: articleIdParamsSchema,
        body: translateBodySchema,
        response: { 200: translateResponseSchema },
      },
    );
}
