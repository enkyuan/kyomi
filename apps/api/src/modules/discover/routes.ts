import type { Elysia } from "elysia";
import { t } from "elysia";
import { enforceRateLimitForContext } from "@adapters/rate-limit/plugin";
import { v1HandlerContext } from "@shared/http/v1/context";
import {
  discoverPreviewQuery,
  discoverPreviewRateLimit,
  discoverSearchQuery,
  discoverSearchRateLimit,
  feedPreviewResponse,
  feedSearchItem,
} from "./schemas";
import { previewFeedFromUrl, searchFeeds } from "./service";

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
        query: discoverSearchQuery,
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
        query: discoverPreviewQuery,
        response: {
          200: feedPreviewResponse,
        },
      },
    );
}
