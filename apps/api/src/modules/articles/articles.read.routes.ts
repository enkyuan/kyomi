import type { Elysia } from "elysia";
import { t } from "elysia";
import { v1HandlerContext } from "@shared/http/v1-handler-context";
import { listClipsForUser } from "./articles.clips";
import {
  countFeedArticlesPublishedInRange,
  getArticleCountsForUser,
  getUnreadCountsPerFeed,
} from "./articles.counts";
import { getArticleDetailForUser } from "./articles.detail";
import { listArticlesForUser } from "./articles.list";
import { parseArticlesListQuery, parseOptionalIsoDate } from "./articles.query";
import {
  articleDetailSchema,
  articleIdParamsSchema,
  checkSavedQuerySchema,
  articleCountsQuerySchema,
  countsResponseSchema,
  cursorListResponseSchema,
  savedCheckResponseSchema,
  unreadCountsQuerySchema,
} from "./articles.schemas";
import { checkSavedArticleForUser } from "./articles.saved-check";
import {
  listMergedRecentlyReadView,
  listMergedSavedView,
  listMergedTodayView,
} from "./articles.views-merged";

export function registerArticleReadRoutes(app: Elysia) {
  return app
    .get(
      "/articles/views/today",
      async (context) => {
        const { db, userId } = v1HandlerContext(context);
        return listMergedTodayView(db, userId, 100);
      },
      { response: { 200: cursorListResponseSchema } },
    )
    .get(
      "/articles/views/recently-read",
      async (context) => {
        const { db, userId } = v1HandlerContext(context);
        return listMergedRecentlyReadView(db, userId, 100);
      },
      { response: { 200: cursorListResponseSchema } },
    )
    .get(
      "/articles/views/read-later",
      async (context) => {
        const { db, userId } = v1HandlerContext(context);
        return listMergedSavedView(db, userId, 100);
      },
      { response: { 200: cursorListResponseSchema } },
    )
    .get(
      "/articles/counts",
      async (context) => {
        const { db, query, userId } = v1HandlerContext<
          unknown,
          { published_after?: string; published_before?: string }
        >(context);
        const base = await getArticleCountsForUser(db, userId);
        const publishedAfter = parseOptionalIsoDate(query.published_after);
        const publishedBefore = parseOptionalIsoDate(query.published_before);
        if (publishedAfter && publishedBefore) {
          const today = await countFeedArticlesPublishedInRange(
            db,
            userId,
            publishedAfter,
            publishedBefore,
          );
          return { ...base, today };
        }
        return base;
      },
      {
        query: articleCountsQuerySchema,
        response: { 200: countsResponseSchema },
      },
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
        query: unreadCountsQuerySchema,
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
        query: checkSavedQuerySchema,
        response: { 200: savedCheckResponseSchema },
      },
    )
    .get(
      "/articles/saved",
      async (context) => {
        const { db, userId } = v1HandlerContext(context);
        return listMergedSavedView(db, userId, 100);
      },
      { response: { 200: cursorListResponseSchema } },
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
            publishedAfter: parsed.publishedAfter,
            publishedBefore: parsed.publishedBefore,
          });
        }
        return listArticlesForUser(db, userId, {
          limit: parsed.limit,
          cursor: parsed.cursor,
          feedId: parsed.feedId,
          folderId: parsed.folderId,
          isRead: parsed.isRead,
          isSaved: parsed.isSaved,
          publishedAfter: parsed.publishedAfter,
          publishedBefore: parsed.publishedBefore,
        });
      },
      {
        response: { 200: cursorListResponseSchema },
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
        response: { 200: cursorListResponseSchema },
      },
    )
    .get(
      "/articles/:articleId",
      async (context) => {
        const { db, params, userId } = v1HandlerContext(context);
        return getArticleDetailForUser(db, userId, params.articleId);
      },
      {
        params: articleIdParamsSchema,
        response: { 200: articleDetailSchema },
      },
    );
}
