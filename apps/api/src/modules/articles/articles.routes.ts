import type { Elysia } from "elysia";
import { t } from "elysia";
import { v1HandlerContext } from "@shared/http/v1-handler-context";
import { uuidParam } from "@shared/http/v1-stub";
import { createArticleClip, listClipsForUser } from "./articles.clips";
import { getArticleCountsForUser } from "./articles.counts";
import { getArticleDetailForUser } from "./articles.detail";
import {
  extractFullTextFromUrl,
  resolveEnhancementContent,
  summarizeContent,
  translateContent,
} from "./articles.enhancements";
import { listArticlesForUser } from "./articles.list";
import { checkSavedArticleForUser } from "./articles.saved-check";
import { updateArticleOrClipForUser } from "./articles.update";
import {
  listMergedRecentlyReadView,
  listMergedSavedView,
  listMergedTodayView,
} from "./articles.views-merged";

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

const articleDetail = t.Object({
  id: t.String(),
  title: t.String(),
  link: t.String(),
  summary: t.Union([t.String(), t.Null()]),
  content: t.Union([t.String(), t.Null()]),
  publishedAt: t.String(),
  feedId: t.String(),
  feedTitle: t.String(),
  isRead: t.Boolean(),
  isSaved: t.Boolean(),
  articleType: t.Union([t.Literal("feed"), t.Literal("clip")]),
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

const extractResponse = t.Object({
  content: t.String(),
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
      "/articles/check-saved",
      async (context) => {
        const { db, query, userId } = v1HandlerContext(context);
        const url = typeof query.url === "string" ? query.url : "";
        return checkSavedArticleForUser(db, userId, url);
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
        const content = await extractFullTextFromUrl(article.link);
        logger.info("articles.extract_full_text.succeeded", {
          userId,
          articleId: params.articleId,
        });
        return { content };
      },
      {
        params: t.Object({ articleId: uuidParam }),
        response: { 200: extractResponse },
      },
    )
    .post(
      "/articles/:articleId/summarize",
      async (context) => {
        const { body, db, logger, params, userId } = v1HandlerContext(context);
        const article = await getArticleDetailForUser(db, userId, params.articleId);
        const raw =
          typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
        const content = resolveEnhancementContent(
          typeof raw.content === "string" ? raw.content : undefined,
          article,
        );
        const summary = summarizeContent(
          content,
          typeof raw.language_key === "string" ? raw.language_key : undefined,
        );
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
        const { body, db, logger, params, userId } = v1HandlerContext(context);
        const article = await getArticleDetailForUser(db, userId, params.articleId);
        const raw =
          typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
        const targetLanguage =
          typeof raw.target_language === "string" ? raw.target_language : "original";
        const content = resolveEnhancementContent(
          typeof raw.content === "string" ? raw.content : undefined,
          article,
        );
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
          autoRefreshEmpty: Boolean(parsed.feedId),
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
        const { body, db, logger, set, userId } = v1HandlerContext(context);
        const raw =
          typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
        const url = typeof raw.url === "string" ? raw.url : "";
        const detail = await createArticleClip(db, userId, {
          url,
          title: typeof raw.title === "string" ? raw.title : undefined,
          content: typeof raw.content === "string" ? raw.content : undefined,
          note: typeof raw.note === "string" ? raw.note : undefined,
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
        const { body, db, params, userId } = v1HandlerContext(context);
        const raw =
          typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
        await updateArticleOrClipForUser(db, userId, params.articleId, raw);
        return { message: "Article updated" };
      },
      {
        params: t.Object({ articleId: uuidParam }),
        body: t.Object({
          isRead: t.Optional(t.Union([t.Boolean(), t.Null()])),
          isSaved: t.Optional(t.Boolean()),
          title: t.Optional(t.String()),
          note: t.Optional(t.Union([t.String(), t.Null()])),
          content: t.Optional(t.Union([t.String(), t.Null()])),
        }),
        response: { 200: messageResponse },
      },
    );
}
