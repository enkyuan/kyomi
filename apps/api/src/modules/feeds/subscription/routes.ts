import type { Elysia } from "elysia";
import { t } from "elysia";
import { enforceRateLimitForContext } from "@adapters/rate-limit/plugin";
import { runEffect } from "@shared/http/effect/bridge";
import { v1EffectContext } from "@shared/http/v1/context";
import { uuidParam } from "@shared/http/v1/params";
import { getFeedDetailForUser, listSubscribedFeeds } from "../read/queries";
import type { FeedsRuntime } from "../runtime";
import * as dto from "../schemas";
import {
  bulkMoveFeedsToFolder,
  bulkUnsubscribeFromFeeds,
  unsubscribeFromFeed,
  updateFeedSubscriptionSettings,
} from "./mutations";
import { subscribeById, subscribeByUrl } from "./operations";

const createFeedRateLimit = {
  name: "feeds.create_by_url",
  max: 20,
  windowMs: 10 * 60_000,
} as const;

export function registerFeedSubscriptionRoutes(app: Elysia, runtime: FeedsRuntime) {
  return app
    .post(
      "/feeds",
      async (context) => {
        const { body, request, requestId, set, userId } = v1EffectContext<{ url: string }>(context);
        await enforceRateLimitForContext(context, userId, createFeedRateLimit);
        const result = await runEffect(
          { runtime, request, requestId, userId },
          subscribeByUrl(userId, body.url),
        );
        set.status = result.newSubscription ? 201 : 200;
        return result;
      },
      {
        body: dto.subscribeFeedsByUrlBody,
        response: {
          200: dto.feedSubscribeResult,
          201: dto.feedSubscribeResult,
        },
      },
    )
    .post(
      "/feeds/:feedId/subscribe",
      async (context) => {
        const { params, request, requestId, set, userId } = v1EffectContext(context);
        const result = await runEffect(
          { runtime, request, requestId, userId },
          subscribeById(userId, params.feedId),
        );
        set.status = result.newSubscription ? 201 : 200;
        return result;
      },
      {
        params: t.Object({ feedId: uuidParam }),
        response: {
          200: dto.feedSubscribeResult,
          201: dto.feedSubscribeResult,
        },
      },
    )
    .delete(
      "/feeds",
      (context) => {
        const { body, request, requestId, userId } = v1EffectContext<{ feedIds: string[] }>(
          context,
        );
        return runEffect(
          { runtime, request, requestId, userId },
          bulkUnsubscribeFromFeeds(userId, body.feedIds),
        );
      },
      {
        body: dto.unsubscribeBulkBody,
        response: {
          200: dto.bulkUnsubscribeResponse,
        },
      },
    )
    .patch(
      "/feeds/folder",
      (context) => {
        const { body, request, requestId, userId } = v1EffectContext<{
          feedIds: string[];
          folderId: string | null;
        }>(context);
        return runEffect(
          { runtime, request, requestId, userId },
          bulkMoveFeedsToFolder(userId, body.feedIds, body.folderId),
        );
      },
      {
        body: dto.moveFeedsBulkBody,
        response: {
          200: dto.bulkMoveFeedsResponse,
        },
      },
    )
    .get(
      "/feeds",
      async (context) => {
        // Refresh contract: read endpoints must be side-effect free.
        const { request, requestId, userId } = v1EffectContext(context);
        const items = await runEffect(
          { runtime, request, requestId, userId },
          listSubscribedFeeds(userId),
        );
        return { items };
      },
      {
        response: {
          200: dto.subscribedFeedsListResponse,
        },
      },
    )
    .get(
      "/feeds/:feedId",
      (context) => {
        // Refresh state is surfaced from persisted feed row fields, never guessed in API/UI.
        const { params, request, requestId, userId } = v1EffectContext(context);
        return runEffect(
          { runtime, request, requestId, userId },
          getFeedDetailForUser(userId, params.feedId),
        );
      },
      {
        params: t.Object({ feedId: uuidParam }),
        response: {
          200: dto.feedDetailResponse,
        },
      },
    )
    .put(
      "/feeds/:feedId",
      (context) => {
        const { body, params, request, requestId, userId } = v1EffectContext<
          { customTitle?: string | null; isPinned?: boolean },
          Record<string, unknown>,
          { feedId: string }
        >(context);
        return runEffect(
          { runtime, request, requestId, userId },
          updateFeedSubscriptionSettings(userId, params.feedId, body),
        );
      },
      {
        params: t.Object({ feedId: uuidParam }),
        body: dto.updateFeedSubscriptionBody,
        response: {
          200: dto.messageResponse,
        },
      },
    )
    .delete(
      "/feeds/:feedId",
      (context) => {
        const { params, request, requestId, userId } = v1EffectContext(context);
        return runEffect(
          { runtime, request, requestId, userId },
          unsubscribeFromFeed(userId, params.feedId),
        );
      },
      {
        params: t.Object({ feedId: uuidParam }),
        response: {
          200: dto.messageResponse,
        },
      },
    );
}
