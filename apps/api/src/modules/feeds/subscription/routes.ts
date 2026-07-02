import type { Elysia } from "elysia";
import { t } from "elysia";
import { enforceRateLimitForContext } from "@adapters/rate-limit/plugin";
import { v1HandlerContext } from "@shared/http/v1/context";
import { uuidParam } from "@shared/http/v1/stub";
import { getFeedDetailForUser, listSubscribedFeeds } from "../read/service";
import { enqueueFeedRefresh } from "../refresh/service";
import * as schemas from "../schemas";
import {
  bulkMoveFeedsToFolder,
  bulkUnsubscribeFromFeeds,
  unsubscribeFromFeed,
  updateFeedSubscriptionSettings,
} from "./mutations";
import { createOrSubscribeToFeed, subscribeToExistingFeed } from "./service";

const createFeedRateLimit = {
  name: "feeds.create_by_url",
  max: 20,
  windowMs: 10 * 60_000,
} as const;

export function registerFeedSubscriptionRoutes(app: Elysia) {
  return app
    .post(
      "/feeds",
      async (context) => {
        const { body, db, logger, set, userId } = v1HandlerContext<{ url: string }>(context);
        await enforceRateLimitForContext(context, userId, createFeedRateLimit);
        const result = await createOrSubscribeToFeed(db, userId, body.url.trim());
        if (result.newSubscription) {
          await enqueueFeedRefresh(db, result.feedId, userId, "subscription_created", logger);
        }
        set.status = result.newSubscription ? 201 : 200;
        logger.info("feeds.subscribe.by_url", {
          userId,
          feedId: result.feedId,
          newFeed: result.newFeed,
          newSubscription: result.newSubscription,
        });
        return result;
      },
      {
        body: schemas.subscribeFeedsByUrlBody,
        response: {
          200: schemas.feedSubscribeResult,
          201: schemas.feedSubscribeResult,
        },
      },
    )
    .post(
      "/feeds/:feedId/subscribe",
      async (context) => {
        const { db, logger, params, set, userId } = v1HandlerContext(context);
        const result = await subscribeToExistingFeed(db, userId, params.feedId);
        if (result.newSubscription) {
          await enqueueFeedRefresh(db, result.feedId, userId, "subscription_created", logger);
        }
        set.status = result.newSubscription ? 201 : 200;
        logger.info("feeds.subscribe.by_id", {
          userId,
          feedId: result.feedId,
          newSubscription: result.newSubscription,
        });
        return result;
      },
      {
        params: t.Object({ feedId: uuidParam }),
        response: {
          200: schemas.feedSubscribeResult,
          201: schemas.feedSubscribeResult,
        },
      },
    )
    .delete(
      "/feeds",
      async (context) => {
        const { body, db, logger, userId } = v1HandlerContext<{ feedIds: string[] }>(context);
        const result = await bulkUnsubscribeFromFeeds(db, userId, body.feedIds);
        logger.info("feeds.unsubscribe.bulk", { userId, removedCount: result.removedCount });
        return result;
      },
      {
        body: schemas.unsubscribeBulkBody,
        response: {
          200: schemas.bulkUnsubscribeResponse,
        },
      },
    )
    .patch(
      "/feeds/folder",
      async (context) => {
        const { body, db, logger, userId } = v1HandlerContext<{
          feedIds: string[];
          folderId: string;
        }>(context);
        const result = await bulkMoveFeedsToFolder(db, userId, body.feedIds, body.folderId);
        logger.info("feeds.folder.bulk_move", {
          userId,
          folderId: body.folderId,
          updatedCount: result.updatedCount,
        });
        return result;
      },
      {
        body: schemas.moveFeedsBulkBody,
        response: {
          200: schemas.bulkMoveFeedsResponse,
        },
      },
    )
    .get(
      "/feeds",
      async (context) => {
        // Refresh contract: read endpoints must be side-effect free.
        const { db, userId } = v1HandlerContext(context);
        const items = await listSubscribedFeeds(db, userId);
        return { items };
      },
      {
        response: {
          200: schemas.subscribedFeedsListResponse,
        },
      },
    )
    .get(
      "/feeds/:feedId",
      async (context) => {
        // Refresh state is surfaced from persisted feed row fields, never guessed in API/UI.
        const { db, logger, params, userId } = v1HandlerContext(context);
        const detail = await getFeedDetailForUser(db, userId, params.feedId);
        logger.info("feeds.detail", {
          userId,
          feedId: params.feedId,
          isSubscribed: detail.isSubscribed,
        });
        return detail;
      },
      {
        params: t.Object({ feedId: uuidParam }),
        response: {
          200: schemas.feedDetailResponse,
        },
      },
    )
    .put(
      "/feeds/:feedId",
      async (context) => {
        const { body, db, logger, params, userId } = v1HandlerContext<
          { customTitle?: string | null; isPinned?: boolean },
          Record<string, unknown>,
          { feedId: string }
        >(context);
        const result = await updateFeedSubscriptionSettings(db, userId, params.feedId, body);
        logger.info("feeds.subscription.updated", { userId, feedId: params.feedId });
        return result;
      },
      {
        params: t.Object({ feedId: uuidParam }),
        body: schemas.updateFeedSubscriptionBody,
        response: {
          200: schemas.messageResponse,
        },
      },
    )
    .delete(
      "/feeds/:feedId",
      async (context) => {
        const { db, logger, params, userId } = v1HandlerContext(context);
        const result = await unsubscribeFromFeed(db, userId, params.feedId);
        logger.info("feeds.unsubscribe", { userId, feedId: params.feedId });
        return result;
      },
      {
        params: t.Object({ feedId: uuidParam }),
        response: {
          200: schemas.messageResponse,
        },
      },
    );
}
