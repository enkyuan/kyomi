import type { Elysia } from "elysia";
import { t } from "elysia";
import type { ManagedRuntime } from "effect";
import type { HttpClient } from "effect/http";
import type { Db } from "@adapters/db/service";
import type { AppLogger } from "@adapters/logger/service";
import { enforceRateLimitForContext } from "@adapters/rate-limit/plugin";
import type { FeedSearch } from "@adapters/search/service";
import { runEffect } from "@shared/http/effect/bridge";
import { v1EffectContext } from "@shared/http/v1/context";
import {
  discoverPreviewQuery,
  discoverPreviewRateLimit,
  discoverSearchQuery,
  discoverSearchRateLimit,
  feedPreviewResponse,
  feedSearchItem,
} from "./schemas";
import { previewFeedForUser, searchFeedsForUser } from "./operations";

type DiscoverServices = Db | AppLogger | FeedSearch | HttpClient.HttpClient;
type DiscoverRuntime = ManagedRuntime.ManagedRuntime<DiscoverServices, unknown>;

export function registerDiscoverRoutes(app: Elysia, runtime: DiscoverRuntime) {
  return app
    .get(
      "/discover/search",
      async (context) => {
        const { query, request, requestId, userId } = v1EffectContext<
          unknown,
          { q: string; limit?: number }
        >(context);
        await enforceRateLimitForContext(context, userId, discoverSearchRateLimit);
        return runEffect(
          { runtime, request, requestId, userId },
          searchFeedsForUser(userId, query.q, query.limit),
        );
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
        const { query, request, requestId, userId } = v1EffectContext<unknown, { url: string }>(
          context,
        );
        await enforceRateLimitForContext(context, userId, discoverPreviewRateLimit);
        return runEffect(
          { runtime, request, requestId, userId },
          previewFeedForUser(userId, query.url),
        );
      },
      {
        query: discoverPreviewQuery,
        response: {
          200: feedPreviewResponse,
        },
      },
    );
}
