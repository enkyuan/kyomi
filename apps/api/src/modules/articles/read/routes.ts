import type { Elysia } from "elysia";
import { t } from "elysia";
import { v1HandlerContext } from "@shared/http/v1-handler-context";
import { listClipsForUser } from "../write/clips";
import {
  countFeedArticlesPublishedInRange,
  getArticleCountsForUser,
  getUnreadCountsPerFeed,
} from "./counts";
import { getArticleDetailForUser } from "./detail";
import { listArticlesForUser } from "./list";
import { parseArticlesListQuery, parseMergedViewListQuery, parseOptionalIsoDate } from "../query";
import {
  articleDetailSchema,
  articleIdParamsSchema,
  checkSavedQuerySchema,
  articleCountsQuerySchema,
  countsResponseSchema,
  cursorListResponseSchema,
  mergedArticleViewsQuerySchema,
  savedCheckResponseSchema,
  unreadCountsQuerySchema,
} from "../schemas";
import { checkSavedArticleForUser } from "./saved-check";
import {
  listMergedRecentlyReadView,
  listMergedSavedView,
  listMergedTodayView,
} from "./views-merged";

export function registerArticleReadRoutes(app: Elysia) {
  return (
    app
      .get(
        "/articles/views/today",
        async (context) => {
          const { db, query, userId } = v1HandlerContext(context);
          const merged = parseMergedViewListQuery(query as Record<string, unknown>);
          return listMergedTodayView(db, userId, merged.limit, merged.cursor);
        },
        {
          query: mergedArticleViewsQuerySchema,
          response: { 200: cursorListResponseSchema },
        },
      )
      .get(
        "/articles/views/recently-read",
        async (context) => {
          const { db, query, userId } = v1HandlerContext(context);
          const merged = parseMergedViewListQuery(query as Record<string, unknown>);
          return listMergedRecentlyReadView(db, userId, merged.limit, merged.cursor);
        },
        {
          query: mergedArticleViewsQuerySchema,
          response: { 200: cursorListResponseSchema },
        },
      )
      .get(
        "/articles/views/read-later",
        async (context) => {
          const { db, query, userId } = v1HandlerContext(context);
          const merged = parseMergedViewListQuery(query as Record<string, unknown>);
          return listMergedSavedView(db, userId, merged.limit, merged.cursor);
        },
        {
          query: mergedArticleViewsQuerySchema,
          response: { 200: cursorListResponseSchema },
        },
      )
      .get(
        "/articles/counts",
        async (context) => {
          const { db, query, userId } = v1HandlerContext<
            unknown,
            {
              published_after?: string;
              published_before?: string;
              feed_id?: string;
              folder_id?: string;
            }
          >(context);
          const scope = {
            feedId: typeof query.feed_id === "string" ? query.feed_id : undefined,
            folderId: typeof query.folder_id === "string" ? query.folder_id : undefined,
          };
          const publishedAfter = parseOptionalIsoDate(query.published_after);
          const publishedBefore = parseOptionalIsoDate(query.published_before);
          const wantsTodayRange = Boolean(publishedAfter && publishedBefore);
          const [base, today] = await Promise.all([
            getArticleCountsForUser(db, userId, scope),
            wantsTodayRange
              ? countFeedArticlesPublishedInRange(
                  db,
                  userId,
                  publishedAfter!,
                  publishedBefore!,
                  scope,
                )
              : Promise.resolve<number | null>(null),
          ]);
          if (today !== null) {
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
      // Legacy alias for read-later merged view — prefer GET /articles/views/read-later.
      .get(
        "/articles/saved",
        async (context) => {
          const { db, query, userId } = v1HandlerContext(context);
          const merged = parseMergedViewListQuery(query as Record<string, unknown>);
          return listMergedSavedView(db, userId, merged.limit, merged.cursor);
        },
        {
          query: mergedArticleViewsQuerySchema,
          response: { 200: cursorListResponseSchema },
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
              publishedAfter: parsed.publishedAfter,
              publishedBefore: parsed.publishedBefore,
            });
          }
          return listArticlesForUser(db, userId, {
            limit: parsed.limit,
            cursor: parsed.cursor,
            search: parsed.search,
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
      // Deprecated: use GET /articles/clips (same behavior).
      .get(
        "/articles/write/clips",
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
      )
  );
}
