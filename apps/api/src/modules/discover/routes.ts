import type { Elysia } from "elysia";
import { t } from "elysia";
import { enforceRateLimitForContext } from "@adapters/rate-limit/rate-limit.plugin";
import { v1HandlerContext } from "@shared/http/v1-handler-context";
import { previewFeedFromUrl, searchFeeds } from "./service";

const discoverSearchRateLimit = {
  name: "discover.search",
  max: 60,
  windowMs: 60_000,
} as const;

const discoverPreviewRateLimit = {
  name: "discover.preview",
  max: 20,
  windowMs: 5 * 60_000,
} as const;

const feedPreviewResponse = t.Object({
  id: t.Union([t.String(), t.Null()]),
  url: t.String(),
  title: t.String(),
  description: t.String(),
  link: t.Union([t.String(), t.Null()]),
  faviconUrl: t.Union([t.String(), t.Null()]),
  isSubscribed: t.Boolean(),
});

const feedSearchItem = t.Object({
  id: t.String(),
  url: t.String(),
  title: t.String(),
  description: t.Union([t.String(), t.Null()]),
  link: t.Union([t.String(), t.Null()]),
  faviconUrl: t.Union([t.String(), t.Null()]),
  isSubscribed: t.Boolean(),
});

export function registerDiscoverRoutes(app: Elysia) {
  return app
    .get(
      "/discover/search",
      async (context) => {
        const { db, logger, userId, query } = v1HandlerContext<
          unknown,
          { q: string; limit?: number }
        >(context);
        await enforceRateLimitForContext(context, userId, discoverSearchRateLimit);
        const limit = Math.min(50, Math.max(1, Number(query.limit ?? 20) || 20));
        const items = await searchFeeds(db, userId, query.q, limit, logger);
        logger.info("discover.search.ok", {
          userId,
          query: query.q,
          resultCount: items.length,
        });
        return items;
      },
      {
        query: t.Object({
          q: t.String({ minLength: 1 }),
          limit: t.Optional(t.Numeric()),
        }),
        response: {
          200: t.Array(feedSearchItem),
        },
      },
    )
    .get(
      "/discover/preview",
      async (context) => {
        const { db, logger, userId, query } = v1HandlerContext<unknown, { url: string }>(context);
        await enforceRateLimitForContext(context, userId, discoverPreviewRateLimit);
        const preview = await previewFeedFromUrl(db, userId, query.url);
        logger.info("discover.preview.ok", {
          userId,
          url: preview.url,
          isSubscribed: preview.isSubscribed,
        });
        return preview;
      },
      {
        query: t.Object({
          url: t.String({ minLength: 1 }),
        }),
        response: {
          200: feedPreviewResponse,
        },
      },
    );
}
