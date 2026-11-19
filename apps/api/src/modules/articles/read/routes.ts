import { Elysia, t } from "elysia";
import type { Effect, ManagedRuntime } from "effect";
import type { Db } from "@adapters/db/service";
import type { AppLogger } from "@adapters/logger/service";
import type { AppConfig } from "@config/env/service";
import type { CurrentUser, RequestContext } from "@shared/effect/request";
import { runEffect } from "@shared/http/effect/bridge";
import { v1EffectContext } from "@shared/http/v1/context";
import { parseSupportedDocumentVersion } from "@modules/articles/document/negotiate";
import { parseArticlesListQuery, parseMergedViewListQuery } from "../params";
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
import { checkSavedArticle } from "./saved";
import { listAllArticles } from "./list/query";
import { listMergedRecentlyReadView, listMergedSavedView, listMergedTodayView } from "./list/views";
import {
  readArticleDetail,
  readArticlesPage,
  readClipsPage,
  readCounts,
  readUnreadCounts,
  type CountsQuery,
} from "./operations";

type ArticleReadServices = Db | AppLogger | AppConfig;

export type ArticleReadRuntime = ManagedRuntime.ManagedRuntime<ArticleReadServices, unknown>;

const mergedViewRoute = {
  query: mergedArticleViewsQuerySchema,
  response: { 200: cursorListResponseSchema },
};

export function registerArticleReadRoutes(app: Elysia, runtime: ArticleReadRuntime) {
  /** The authenticated request's input, and `run` to execute an Effect for it on the runtime. */
  const route = <TQuery = Record<string, unknown>, TParams = Record<string, string>>(
    context: unknown,
  ) => {
    const { request, requestId, userId, params, query } = v1EffectContext<unknown, TQuery, TParams>(
      context,
    );
    return {
      request,
      userId,
      params,
      query,
      run: <A, E>(
        effect: Effect.Effect<A, E, ArticleReadServices | RequestContext | CurrentUser>,
      ) => runEffect({ runtime, request, requestId, userId }, effect),
    };
  };
  /** `GET /articles/clips` and its deprecated alias `GET /articles/write/clips`. */
  const clips = (context: unknown) => {
    const { query, userId, run } = route(context);
    return run(readClipsPage(userId, parseArticlesListQuery(query)));
  };
  /** `GET /articles/views/read-later` and its legacy alias `GET /articles/saved`. */
  const readLater = (context: unknown) => {
    const { query, userId, run } = route(context);
    const merged = parseMergedViewListQuery(query);
    return run(listMergedSavedView(userId, merged.limit, merged.cursor, merged.sort));
  };

  return app
    .get(
      "/articles/views/all",
      (context) => {
        const { query, userId, run } = route(context);
        return run(listAllArticles(userId, parseMergedViewListQuery(query)));
      },
      mergedViewRoute,
    )
    .get(
      "/articles/views/today",
      (context) => {
        const { query, userId, run } = route(context);
        const merged = parseMergedViewListQuery(query);
        return run(listMergedTodayView(userId, merged.limit, merged.cursor, merged.sort));
      },
      mergedViewRoute,
    )
    .get(
      "/articles/views/recently-read",
      (context) => {
        const { query, userId, run } = route(context);
        const merged = parseMergedViewListQuery(query);
        return run(
          listMergedRecentlyReadView(
            userId,
            merged.limit,
            merged.cursor,
            merged.sort,
            merged.search,
          ),
        );
      },
      mergedViewRoute,
    )
    .get("/articles/views/read-later", readLater, mergedViewRoute)
    .get(
      "/articles/counts",
      (context) => {
        const { query, userId, run } = route<CountsQuery>(context);
        return run(readCounts(userId, query));
      },
      { query: articleCountsQuerySchema, response: { 200: countsResponseSchema } },
    )
    .get(
      "/articles/unread-counts",
      (context) => {
        const { query, userId, run } = route<{ feed_ids?: string }>(context);
        return run(
          readUnreadCounts(userId, typeof query.feed_ids === "string" ? query.feed_ids : ""),
        );
      },
      { query: unreadCountsQuerySchema, response: { 200: t.Record(t.String(), t.Number()) } },
    )
    .get(
      "/articles/check-saved",
      (context) => {
        const { query, userId, run } = route<{ url: string }>(context);
        return run(checkSavedArticle(userId, query.url));
      },
      { query: checkSavedQuerySchema, response: { 200: savedCheckResponseSchema } },
    )
    .get("/articles/saved", readLater, mergedViewRoute)
    .get(
      "/articles",
      (context) => {
        const { query, userId, run } = route(context);
        return run(readArticlesPage(userId, parseArticlesListQuery(query)));
      },
      { response: { 200: cursorListResponseSchema } },
    )
    .get("/articles/clips", clips, { response: { 200: cursorListResponseSchema } })
    .get("/articles/write/clips", clips, { response: { 200: cursorListResponseSchema } })
    .get(
      "/articles/:articleId",
      (context) => {
        const { params, request, userId, run } = route<
          Record<string, unknown>,
          { articleId: string }
        >(context);
        // The body varies by the declared version, so any cache in front must key on it.
        context.set.headers.vary = "X-Kyomi-Document-Version";
        return run(
          readArticleDetail(
            userId,
            params.articleId,
            parseSupportedDocumentVersion(request.headers),
          ),
        );
      },
      { params: articleIdParamsSchema, response: { 200: articleDetailSchema } },
    );
}
