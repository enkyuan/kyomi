import type { Elysia } from "elysia";
import { t } from "elysia";
import { v1HandlerContext } from "@shared/http/v1-handler-context";
import { uuidParam } from "@shared/http/v1-stub";
import { createArticleClip, listClipsForUser } from "./articles.clips";
import {
  buildFallbackReaderContent,
  buildReadabilityReaderContent,
} from "./articles.normalize-content";
import { getArticleCountsForUser, getUnreadCountsPerFeed } from "./articles.counts";
import { getArticleDetailForUser } from "./articles.detail";
import {
  resolveEnhancementContent,
  summarizeContent,
  translateContent,
} from "./articles.enhancements";
import { extractArticleContentFromUrl } from "./articles.extract-content";
import {
  listMergedRecentlyReadView,
  listMergedSavedView,
  listMergedTodayView,
} from "./articles.views-merged";
import { updateArticleOrClipForUser } from "./articles.update";
import { listArticlesForUser } from "./articles.list";
import { checkSavedArticleForUser } from "./articles.saved-check";

const readerContent = t.Object({
  contentStatus: t.Union([
    t.Literal("ready"),
    t.Literal("partial"),
    t.Literal("failed"),
    t.Literal("pending"),
  ]),
  contentSource: t.Union([
    t.Literal("feed_html"),
    t.Literal("feed_markdown"),
    t.Literal("feed_summary"),
    t.Literal("extracted_html"),
    t.Literal("text_fallback"),
    t.Literal("link_only"),
  ]),
  bodyKind: t.Union([
    t.Literal("html"),
    t.Literal("markdown"),
    t.Literal("text"),
    t.Literal("fallback"),
  ]),
  title: t.Union([t.String(), t.Null()]),
  byline: t.Union([t.String(), t.Null()]),
  excerpt: t.Union([t.String(), t.Null()]),
  contentHtml: t.Union([t.String(), t.Null()]),
  contentMarkdown: t.Union([t.String(), t.Null()]),
  contentText: t.Union([t.String(), t.Null()]),
  fallbackSummary: t.Union([t.String(), t.Null()]),
  fallbackReason: t.Union([
    t.Literal("extraction_failed"),
    t.Literal("timeout"),
    t.Literal("missing_content"),
    t.Null(),
  ]),
  siteName: t.Union([t.String(), t.Null()]),
  language: t.Union([t.String(), t.Null()]),
  publishedTime: t.Union([t.String(), t.Null()]),
  notice: t.Union([t.String(), t.Null()]),
  extractionErrorCode: t.Union([t.String(), t.Null()]),
  extractionErrorMessage: t.Union([t.String(), t.Null()]),
  shouldExtract: t.Boolean(),
});

const articleDetail = t.Object({
  id: t.String(),
  title: t.String(),
  link: t.String(),
  summary: t.Union([t.String(), t.Null()]),
  contentHtml: t.Union([t.String(), t.Null()]),
  contentText: t.Union([t.String(), t.Null()]),
  contentMarkdown: t.Union([t.String(), t.Null()]),
  contentStatus: t.Union([
    t.Literal("ready"),
    t.Literal("partial"),
    t.Literal("failed"),
    t.Literal("pending"),
  ]),
  contentSource: t.Union([
    t.Literal("feed_html"),
    t.Literal("feed_markdown"),
    t.Literal("feed_summary"),
    t.Literal("extracted_html"),
    t.Literal("text_fallback"),
    t.Literal("link_only"),
  ]),
  extractionErrorCode: t.Union([t.String(), t.Null()]),
  extractionErrorMessage: t.Union([t.String(), t.Null()]),
  publishedAt: t.String(),
  feedId: t.String(),
  feedTitle: t.String(),
  isRead: t.Boolean(),
  isSaved: t.Boolean(),
  articleType: t.Union([t.Literal("feed"), t.Literal("clip")]),
  reader: readerContent,
});

const extractResponse = t.Object({
  reader: readerContent,
  persisted: t.Boolean(),
});

const articleListItem = t.Object({
  id: t.String(),
  title: t.String(),
  link: t.String(),
  summary: t.Union([t.String(), t.Null()]),
  publishedAt: t.String(),
  feedId: t.String(),
  feedTitle: t.String(),
  isRead: t.Boolean(),
  isSaved: t.Boolean(),
  articleType: t.Union([t.Literal("feed"), t.Literal("clip")]),
});

const cursorListResponse = t.Object({
  items: t.Array(articleListItem),
  next_cursor: t.Union([t.String(), t.Null()]),
  has_more: t.Boolean(),
  total_count: t.Null(),
});

const countsResponse = t.Object({
  unread: t.Number(),
  saved: t.Number(),
});

const savedCheckArticle = t.Object({
  id: t.String(),
  title: t.String(),
  url: t.String(),
  articleType: t.Union([t.Literal("feed"), t.Literal("clip")]),
});

const savedCheckResponse = t.Object({
  is_saved: t.Boolean(),
  article: t.Union([savedCheckArticle, t.Null()]),
});

const messageResponse = t.Object({
  message: t.String(),
});

const summarizeBody = t.Object({
  content: t.Optional(t.String()),
  language_key: t.Optional(t.String()),
});

const summarizeResponse = t.Object({
  summary: t.String(),
});

const translateBody = t.Object({
  content: t.Optional(t.String()),
  target_language: t.String({ minLength: 1 }),
});

const translateResponse = t.Object({
  translated_content: t.String(),
  target_language: t.String(),
});

type ParsedListQuery = {
  limit: number;
  cursor: string | undefined;
  feedId: string | undefined;
  folderId: string | undefined;
  source: string;
  isRead: boolean | undefined;
  isSaved: boolean | undefined;
};

function parseArticlesListQuery(query: Record<string, unknown>): ParsedListQuery {
  return {
    limit: Math.min(200, Math.max(1, Number(query.limit ?? 50) || 50)),
    cursor: typeof query.cursor === "string" ? query.cursor : undefined,
    feedId: typeof query.feed_id === "string" ? query.feed_id : undefined,
    folderId: typeof query.folder_id === "string" ? query.folder_id : undefined,
    source: typeof query.source === "string" ? query.source.toLowerCase() : "feeds",
    isRead: query.is_read === "true" ? true : query.is_read === "false" ? false : undefined,
    isSaved: query.is_saved === "true" ? true : undefined,
  };
}

export function registerArticleRoutes(app: Elysia) {
  return app
    .get(
      "/articles/views/today",
      async (context) => {
        const { db, userId } = v1HandlerContext(context);
        return listMergedTodayView(db, userId, 100);
      },
      { response: { 200: cursorListResponse } },
    )
    .get(
      "/articles/views/recently-read",
      async (context) => {
        const { db, userId } = v1HandlerContext(context);
        return listMergedRecentlyReadView(db, userId, 100);
      },
      { response: { 200: cursorListResponse } },
    )
    .get(
      "/articles/views/read-later",
      async (context) => {
        const { db, userId } = v1HandlerContext(context);
        return listMergedSavedView(db, userId, 100);
      },
      { response: { 200: cursorListResponse } },
    )
    .get(
      "/articles/counts",
      async (context) => {
        const { db, userId } = v1HandlerContext(context);
        return getArticleCountsForUser(db, userId);
      },
      { response: { 200: countsResponse } },
    )
    .get(
      "/articles/unread-counts",
      async (context) => {
        const { db, query, userId } = v1HandlerContext<unknown, { feed_ids?: string }>(context);
        const rawIds = typeof query.feed_ids === "string" ? query.feed_ids : "";
        const feedIds = rawIds
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);
        const counts = await getUnreadCountsPerFeed(db, userId, feedIds);
        return counts;
      },
      {
        query: t.Object({
          feed_ids: t.Optional(t.String()),
        }),
        response: { 200: t.Record(t.String(), t.Number()) },
      },
    )
    .get(
      "/articles/check-saved",
      async (context) => {
        const { db, query, userId } = v1HandlerContext<unknown, { url: string }>(context);
        return checkSavedArticleForUser(db, userId, query.url);
      },
      {
        query: t.Object({
          url: t.String({ minLength: 1 }),
        }),
        response: { 200: savedCheckResponse },
      },
    )
    .get(
      "/articles/saved",
      async (context) => {
        const { db, userId } = v1HandlerContext(context);
        return listMergedSavedView(db, userId, 100);
      },
      { response: { 200: cursorListResponse } },
    )
    .post(
      "/articles/:articleId/extract-full-text",
      async (context) => {
        const { db, logger, params, userId } = v1HandlerContext(context);
        const article = await getArticleDetailForUser(db, userId, params.articleId);
        const extracted = await extractArticleContentFromUrl(article.link);

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
            reader.contentStatus !== article.contentStatus ||
            reader.contentSource !== article.contentSource ||
            reader.extractionErrorCode !== article.extractionErrorCode ||
            reader.extractionErrorMessage !== article.extractionErrorMessage
          ) {
            await updateArticleOrClipForUser(db, userId, params.articleId, {
              contentHtml: reader.contentHtml,
              contentText: reader.contentText,
              contentMarkdown: reader.contentMarkdown,
              contentStatus: reader.contentStatus,
              contentSource: reader.contentSource,
              extractionErrorCode: reader.extractionErrorCode,
              extractionErrorMessage: reader.extractionErrorMessage,
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
          reader.contentHtml !== article.contentHtml ||
          reader.contentText !== article.contentText ||
          reader.contentStatus !== article.contentStatus ||
          reader.contentSource !== article.contentSource
        ) {
          await updateArticleOrClipForUser(db, userId, params.articleId, {
            contentHtml: reader.contentHtml,
            contentText: reader.contentText,
            contentMarkdown: reader.contentMarkdown,
            contentStatus: reader.contentStatus,
            contentSource: reader.contentSource,
            extractionErrorCode: reader.extractionErrorCode,
            extractionErrorMessage: reader.extractionErrorMessage,
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
        params: t.Object({ articleId: uuidParam }),
        response: { 200: extractResponse },
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
        params: t.Object({ articleId: uuidParam }),
        body: summarizeBody,
        response: { 200: summarizeResponse },
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
        params: t.Object({ articleId: uuidParam }),
        body: translateBody,
        response: { 200: translateResponse },
      },
    )
    .get(
      "/articles",
      async (context) => {
        const { db, query, userId } = v1HandlerContext(context);
        const parsed = parseArticlesListQuery(query as Record<string, unknown>);
        if (parsed.source === "clips") {
          return listClipsForUser(db, userId, {
            limit: parsed.limit,
            cursor: parsed.cursor,
            isRead: parsed.isRead,
            isSaved: parsed.isSaved,
          });
        }
        return listArticlesForUser(db, userId, {
          limit: parsed.limit,
          cursor: parsed.cursor,
          feedId: parsed.feedId,
          folderId: parsed.folderId,
          isRead: parsed.isRead,
          isSaved: parsed.isSaved,
        });
      },
      {
        response: { 200: cursorListResponse },
      },
    )
    .get(
      "/articles/clips",
      async (context) => {
        const { db, query, userId } = v1HandlerContext(context);
        const limit = Math.min(200, Math.max(1, Number(query.limit ?? 50) || 50));
        const cursor = typeof query.cursor === "string" ? query.cursor : undefined;
        const isRead =
          query.is_read === "true" ? true : query.is_read === "false" ? false : undefined;
        const isSaved = query.is_saved === "true" ? true : undefined;
        return listClipsForUser(db, userId, { limit, cursor, isRead, isSaved });
      },
      {
        response: { 200: cursorListResponse },
      },
    )
    .post(
      "/articles",
      async (context) => {
        const { body, db, logger, set, userId } = v1HandlerContext<{
          url: string;
          title?: string;
          content?: string;
          note?: string;
        }>(context);
        const detail = await createArticleClip(db, userId, {
          url: body.url,
          title: body.title,
          content: body.content,
          note: body.note,
        });
        logger.info("articles.clip.created", { userId, clipId: detail.id });
        set.status = 201;
        return detail;
      },
      {
        body: t.Object({
          url: t.String({ minLength: 1 }),
          title: t.Optional(t.String()),
          content: t.Optional(t.String()),
          note: t.Optional(t.String()),
        }),
        response: {
          201: articleDetail,
        },
      },
    )
    .get(
      "/articles/:articleId",
      async (context) => {
        const { db, params, userId } = v1HandlerContext(context);
        return getArticleDetailForUser(db, userId, params.articleId);
      },
      {
        params: t.Object({ articleId: uuidParam }),
        response: { 200: articleDetail },
      },
    )
    .put(
      "/articles/:articleId",
      async (context) => {
        const { body, db, params, userId } = v1HandlerContext<
          {
            isRead?: boolean | null;
            isSaved?: boolean;
            title?: string;
            note?: string | null;
            contentHtml?: string | null;
            contentText?: string | null;
            contentMarkdown?: string | null;
            contentStatus?: "ready" | "partial" | "failed" | "pending" | null;
            contentSource?:
              | "feed_html"
              | "feed_markdown"
              | "feed_summary"
              | "extracted_html"
              | "text_fallback"
              | "link_only"
              | null;
            extractionErrorCode?: string | null;
            extractionErrorMessage?: string | null;
          },
          Record<string, unknown>,
          { articleId: string }
        >(context);
        await updateArticleOrClipForUser(db, userId, params.articleId, body);
        return { message: "Article updated" };
      },
      {
        params: t.Object({ articleId: uuidParam }),
        body: t.Object({
          isRead: t.Optional(t.Union([t.Boolean(), t.Null()])),
          isSaved: t.Optional(t.Boolean()),
          title: t.Optional(t.String()),
          note: t.Optional(t.Union([t.String(), t.Null()])),
          contentHtml: t.Optional(t.Union([t.String(), t.Null()])),
          contentText: t.Optional(t.Union([t.String(), t.Null()])),
          contentMarkdown: t.Optional(t.Union([t.String(), t.Null()])),
          contentStatus: t.Optional(
            t.Union([
              t.Literal("ready"),
              t.Literal("partial"),
              t.Literal("failed"),
              t.Literal("pending"),
              t.Null(),
            ]),
          ),
          contentSource: t.Optional(
            t.Union([
              t.Literal("feed_html"),
              t.Literal("feed_markdown"),
              t.Literal("feed_summary"),
              t.Literal("extracted_html"),
              t.Literal("text_fallback"),
              t.Literal("link_only"),
              t.Null(),
            ]),
          ),
          extractionErrorCode: t.Optional(t.Union([t.String(), t.Null()])),
          extractionErrorMessage: t.Optional(t.Union([t.String(), t.Null()])),
        }),
        response: { 200: messageResponse },
      },
    );
}
