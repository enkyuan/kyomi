import type { Elysia } from "elysia";
import { embeddingClassifierConfig } from "@config/embeddings";
import { env } from "@config/env";
import { parseSupportedDocumentVersion } from "@modules/articles/document/negotiate";
import { withNegotiatedDocuments } from "@modules/articles/document/serve";
import { assertContentFieldBudget } from "@shared/http/budget";
import { v1HandlerContext } from "@shared/http/v1/context";
import { getArticleDetailForUser } from "../read/detail";
import { resolveEnhancementContent, summarizeContent, translateContent } from "./enrichment";
import { requestFullTextExtractionForUser } from "./extraction/workflow";
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
        const { request } = context as unknown as { request: Request };
        const extraction = await requestFullTextExtractionForUser(db, userId, params.articleId, {
          embeddingClassifier: embeddingClassifierConfig(8000),
          logger,
        });
        // The article in the response follows the same document negotiation as `GET /articles/:id`,
        // so a client never swaps from a document body to an HTML one just by extracting.
        const result = {
          ...extraction,
          article: await withNegotiatedDocuments(db, extraction.article, {
            enabled: env.FEATURE_READER_DOCUMENT,
            maxVersion: parseSupportedDocumentVersion(request.headers),
          }),
        };
        if (result.ok) {
          logger.info("articles.extract_full_text.accepted", {
            userId,
            articleId: params.articleId,
            status: result.status,
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
        assertContentFieldBudget([{ name: "content", value: content }]);
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
        assertContentFieldBudget([{ name: "content", value: content }]);
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
