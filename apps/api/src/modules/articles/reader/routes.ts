import type { Elysia } from "elysia";
import { publishJob } from "@adapters/queue/publish";
import { MAX_CLOUDFLARE_TRANSLATION_CHARS } from "@adapters/translation/cloudflare";
import { getRedis } from "@adapters/redis";
import { embeddingClassifierConfig } from "@config/embeddings";
import { cloudflareTranslationConfig } from "@config/translations";
import { assertContentFieldBudget } from "@shared/http/budget";
import { AppError } from "@shared/errors/app";
import { v1HandlerContext } from "@shared/http/v1/context";
import { getArticleDetailForUser } from "../read/detail";
import {
  resolveEnhancementContent,
  resolveStoredTranslationContent,
  summarizeContent,
} from "./enrichment";
import { requestFullTextExtractionForUser } from "./extraction/workflow";
import {
  articleIdParamsSchema,
  extractFullTextResponseSchema,
  summarizeBodySchema,
  summarizeResponseSchema,
  translateBodySchema,
  translateResponseSchema,
} from "../schemas";
import { findOrQueueFeedItemTranslation } from "./translations/store";

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
          { source_language?: string; target_language: string },
          Record<string, unknown>,
          { articleId: string }
        >(context);
        const article = await getArticleDetailForUser(db, userId, params.articleId);
        const config = cloudflareTranslationConfig();
        if (!config) {
          throw new AppError("Article translation is not enabled", {
            status: 503,
            code: "TRANSLATION_NOT_CONFIGURED",
          });
        }
        const sourceLanguage = resolveTranslationLanguage(
          body.source_language ?? article.reader.selected.language,
          "source_language",
        );
        const targetLanguage = resolveTranslationLanguage(body.target_language, "target_language");
        const content = resolveStoredTranslationContent(article);
        if (article.articleType !== "feed") {
          throw new AppError("Translations are currently available for feed articles only", {
            status: 400,
            code: "TRANSLATION_ARTICLE_TYPE_UNSUPPORTED",
          });
        }

        if (content.length > MAX_CLOUDFLARE_TRANSLATION_CHARS) {
          throw new AppError("Article content exceeds the translation limit", {
            status: 413,
            code: "TRANSLATION_CONTENT_TOO_LARGE",
          });
        }

        const requested = await findOrQueueFeedItemTranslation(db, {
          feedItemId: article.id,
          sourceText: content,
          sourceLanguage,
          targetLanguage,
          modelId: config.model,
        });

        const translation = requested.translation;

        if (translation.status === "queued") {
          try {
            await publishJob(getRedis(), {
              type: "article.translate",
              payload: { translationId: translation.id },
            });
          } catch (error) {
            logger.error("articles.translate.queue_unavailable", {
              userId,
              articleId: article.id,
              translationId: translation.id,
              error: error instanceof Error ? error.message : String(error),
            });

            throw new AppError("Translation could not be queued", {
              status: 503,
              code: "TRANSLATION_QUEUE_UNAVAILABLE",
            });
          }
        }

        logger.info("articles.translate.requested", {
          userId,
          articleId: article.id,
          translationId: translation.id,
          status: translation.status,
          created: requested.created,
          targetLanguage,
        });
        logger.info("articles.translate.succeeded", {
          userId,
          articleId: params.articleId,
          targetLanguage,
        });
        return {
          status: translation.status as "ready" | "queued" | "failed" | "processing",
          translated_content: translation.translatedText,
          source_language: translation.sourceLanguage,
          target_language: translation.targetLanguage,
          error_code: translation.errorCode,
        };
      },
      {
        params: articleIdParamsSchema,
        body: translateBodySchema,
        response: { 200: translateResponseSchema },
      },
    );
}

function resolveTranslationLanguage(value: string | null | undefined, field: string): string {
  const primary = value?.trim().toLowerCase().split("-")[0];
  if (!primary || !/^[a-z]{2,3}$/.test(primary)) {
    throw new AppError(`${field} must be a two or three letter language code`, {
      status: 400,
      code: "TRANSLATION_LANGUAGE_INVALID",
      details: { field },
    });
  }
  return primary;
}
