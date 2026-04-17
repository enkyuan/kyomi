import type { Elysia } from "elysia";
import { v1HandlerContext } from "@shared/http/v1-handler-context";
import { AppError } from "@shared/errors/app-error";
import {
  buildFallbackReaderContent,
  buildReadabilityReaderContent,
} from "./articles.normalize-content";
import { getArticleDetailForUser } from "./articles.detail";
import {
  resolveEnhancementContent,
  summarizeContent,
  translateContent,
} from "./articles.enhancements";
import { extractArticleFullTextFromUrl } from "./articles.extract-full-text";
import { updateArticleOrClipForUser } from "./articles.update";
import {
  articleIdParamsSchema,
  extractResponseSchema,
  summarizeBodySchema,
  summarizeResponseSchema,
  translateBodySchema,
  translateResponseSchema,
} from "./articles.schemas";

export function registerArticleEnhancementRoutes(app: Elysia) {
  return app
    .post(
      "/articles/:articleId/extract-full-text",
      async (context) => {
        const { db, logger, params, userId } = v1HandlerContext(context);
        const article = await getArticleDetailForUser(db, userId, params.articleId);
        if (article.articleType !== "feed") {
          throw new AppError("Full-text extraction is only supported for feed articles.", {
            status: 400,
            code: "EXTRACTION_UNSUPPORTED_ARTICLE_TYPE",
          });
        }
        if (!article.link?.trim()) {
          return {
            reader: buildFallbackReaderContent(
              {
                articleType: article.articleType,
                title: article.title,
                summary: article.summary,
                legacyContent: null,
                contentHtml: article.contentHtml,
                contentText: article.contentText,
                contentMarkdown: article.contentMarkdown,
                contentStatus: article.contentStatus,
                contentSource: article.contentSource,
                extractionErrorCode: article.extractionErrorCode,
                extractionErrorMessage: article.extractionErrorMessage,
              },
              { code: "MISSING_URL", message: "This article has no source URL to extract from." },
            ),
            persisted: false,
          };
        }
        const extracted = await extractArticleFullTextFromUrl(article.link);

        if (!extracted.ok) {
          const reader = buildFallbackReaderContent(
            {
              articleType: article.articleType,
              title: article.title,
              summary: article.summary,
              legacyContent: null,
              contentHtml: article.contentHtml,
              contentText: article.contentText,
              contentMarkdown: article.contentMarkdown,
              contentStatus: article.contentStatus,
              contentSource: article.contentSource,
              extractionErrorCode: article.extractionErrorCode,
              extractionErrorMessage: article.extractionErrorMessage,
            },
            {
              code: extracted.errorCode,
              message: extracted.errorMessage,
            },
          );

          let persisted = false;
          if (
            article.extractedContentStatus !== "failed" ||
            article.extractedContentError !== extracted.errorMessage
          ) {
            await updateArticleOrClipForUser(db, userId, params.articleId, {
              extractedContentHtml: null,
              extractedContentText: null,
              extractedContentStatus: "failed",
              extractedContentError: extracted.errorMessage,
              extractedContentUpdatedAt: new Date().toISOString(),
            });
            persisted = true;
          }

          logger.warn("articles.extract_full_text.fallback", {
            userId,
            articleId: params.articleId,
            errorCode: extracted.errorCode,
            persisted,
          });

          return { reader, persisted };
        }

        const reader = buildReadabilityReaderContent(
          {
            articleType: article.articleType,
            title: article.title,
            summary: article.summary,
            legacyContent: null,
            contentHtml: article.contentHtml,
            contentText: article.contentText,
            contentMarkdown: article.contentMarkdown,
            contentStatus: article.contentStatus,
            contentSource: article.contentSource,
            extractionErrorCode: article.extractionErrorCode,
            extractionErrorMessage: article.extractionErrorMessage,
          },
          extracted.content,
        );

        let persisted = false;
        if (
          reader.contentHtml !== article.extractedContentHtml ||
          reader.contentText !== article.extractedContentText ||
          article.extractedContentStatus !== "ready" ||
          article.extractedContentError
        ) {
          await updateArticleOrClipForUser(db, userId, params.articleId, {
            extractedContentHtml: reader.contentHtml,
            extractedContentText: reader.contentText,
            extractedContentStatus: "ready",
            extractedContentError: null,
            extractedContentUpdatedAt: new Date().toISOString(),
          });
          persisted = true;
        }

        logger.info("articles.extract_full_text.succeeded", {
          userId,
          articleId: params.articleId,
          persisted,
        });

        return { reader, persisted };
      },
      {
        params: articleIdParamsSchema,
        response: { 200: extractResponseSchema },
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
