import type { Elysia } from "elysia";
import { t } from "elysia";
import { enforceRateLimitForContext } from "@adapters/rate-limit/rate-limit.plugin";
import { v1HandlerContext } from "@shared/http/v1-handler-context";
import { uuidParam } from "@shared/http/v1-stub";
import { assertFeedAdminUser } from "./admin/guard";
import { adminDeleteGlobalFeed, adminUpdateGlobalFeed } from "./admin/service";
import { markAllArticlesReadInFeed } from "./read/status";
import type { AdminUpdateGlobalFeedBody } from "./types";
import {
  assertUserSubscribedToFeed,
  bulkMoveFeedsToFolder,
  bulkUnsubscribeFromFeeds,
  createOrSubscribeToFeed,
  getFeedDetailForUser,
  listFeedRefreshStatusesForUser,
  listSubscribedFeeds,
  subscribeToExistingFeed,
  unsubscribeFromFeed,
  updateFeedSubscriptionSettings,
} from "./service";
import * as dto from "./dto";
import {
  enqueueBatchFeedRefresh,
  enqueueFeedRefresh,
  listRefreshableFeedIdsForUser,
} from "./refresh/service";

const createFeedRateLimit = {
  name: "feeds.create_by_url",
  max: 20,
  windowMs: 10 * 60_000,
} as const;

export function registerFeedRoutes(app: Elysia) {
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
          200: dto.feedSubscribeResult,
          201: dto.feedSubscribeResult,
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
        body: dto.unsubscribeBulkBody,
        response: {
          200: dto.bulkUnsubscribeResponse,
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
        const { db, userId } = v1HandlerContext(context);
        const items = await listSubscribedFeeds(db, userId);
        return { items };
      },
      {
        response: {
          200: dto.subscribedFeedsListResponse,
        },
      },
    )
    .get(
      "/feeds/refresh-status",
      async (context) => {
        const { db, query, userId } = v1HandlerContext<unknown, { folder_id?: string }>(context);
        const folderId =
          typeof query.folder_id === "string" && query.folder_id.trim().length > 0
            ? query.folder_id.trim()
            : undefined;
        const items = await listFeedRefreshStatusesForUser(db, userId, folderId);
        return { items };
      },
      {
        response: {
          200: dto.feedRefreshStatusListResponse,
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
          200: dto.feedDetailResponse,
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
        body: dto.updateFeedSubscriptionBody,
        response: {
          200: dto.messageResponse,
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
          200: dto.messageResponse,
        },
      },
    )
    .put(
      "/feeds/:feedId/read-status",
      async (context) => {
        const { db, logger, params, userId } = v1HandlerContext(context);
        const result = await markAllArticlesReadInFeed(db, userId, params.feedId);
        logger.info("feeds.read_status.mark_all", { userId, feedId: params.feedId });
        return result;
      },
      {
        params: t.Object({ feedId: uuidParam }),
        response: {
          200: dto.messageResponse,
        },
      },
    )
    .put(
      "/feeds/:feedId/admin",
      async (context) => {
        const { body, db, logger, params, userId } = v1HandlerContext<
          AdminUpdateGlobalFeedBody,
          Record<string, unknown>,
          { feedId: string }
        >(context);
        assertFeedAdminUser(userId, context.request.headers);
        const detail = await adminUpdateGlobalFeed(db, params.feedId, body);
        logger.info("feeds.admin.updated", { userId, feedId: params.feedId });
        return detail;
      },
      {
        params: t.Object({ feedId: uuidParam }),
        body: dto.adminUpdateGlobalFeedBody,
        response: {
          200: dto.adminGlobalFeedDetail,
        },
      },
    )
    .delete(
      "/feeds/:feedId/admin",
      async (context) => {
        const { db, logger, params, userId } = v1HandlerContext(context);
        assertFeedAdminUser(userId, context.request.headers);
        await adminDeleteGlobalFeed(db, params.feedId);
        logger.info("feeds.admin.deleted", { userId, feedId: params.feedId });
        return { message: "Feed deleted" };
      },
      {
        params: t.Object({ feedId: uuidParam }),
        response: {
          200: dto.messageResponse,
        },
      },
    )
    .post(
      "/feeds/:feedId/refresh",
      async (context) => {
        // Refresh is an explicit action and always flows through queue -> worker -> ingestion.
        const { db, logger, set, userId, params } = v1HandlerContext(context);
        await assertUserSubscribedToFeed(db, userId, params.feedId);
        const { jobId } = await enqueueFeedRefresh(db, params.feedId, userId, "manual", logger);
        set.status = 202;
        return {
          accepted: true as const,
          jobId,
          type: "feed.refresh" as const,
        };
      },
      { params: t.Object({ feedId: uuidParam }) },
    )
    .post(
      "/feeds/refresh",
      async (context) => {
        const { db, logger, set, userId, body } = v1HandlerContext<{ folderId?: string }>(context);
        const { folderId } = body || {};

        const feedIdsToRefresh = await listRefreshableFeedIdsForUser(db, userId, folderId);
        const result = await enqueueBatchFeedRefresh(
          db,
          feedIdsToRefresh,
          userId,
          "manual",
          logger,
        );

        set.status = 202;
        return result;
      },
      {
        body: t.Optional(t.Object({ folderId: t.Optional(uuidParam) })),
      },
    );
}
