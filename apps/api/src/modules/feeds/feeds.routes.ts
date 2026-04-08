import type { Elysia } from "elysia";
import { t } from "elysia";
import { publishJob } from "@adapters/queue/publish-job";
import { getRedis } from "@adapters/redis";
import { AppError } from "@shared/errors/app-error";
import { v1HandlerContext } from "@shared/http/v1-handler-context";
import { uuidParam } from "@shared/http/v1-stub";
import { assertFeedAdminUser } from "./feeds.admin-guard";
import { adminDeleteGlobalFeed, adminUpdateGlobalFeed } from "./feeds.admin.service";
import { markAllArticlesReadInFeed } from "./feeds.read-status";
import type { AdminUpdateGlobalFeedBody } from "./feeds.types";
import {
  assertUserSubscribedToFeed,
  bulkMoveFeedsToFolder,
  bulkUnsubscribeFromFeeds,
  createOrSubscribeToFeed,
  getFeedDetailForUser,
  listSubscribedFeeds,
  subscribeToExistingFeed,
  unsubscribeFromFeed,
  updateFeedSubscriptionSettings,
} from "./feeds.service";
import * as dto from "./feeds.dto";

export function registerFeedRoutes(app: Elysia) {
  return app
    .post(
      "/feeds",
      async (context) => {
        const { body, db, logger, set, userId } = v1HandlerContext(context);
        const url =
          typeof body === "object" && body !== null && "url" in body
            ? String((body as { url: unknown }).url).trim()
            : "";
        const result = await createOrSubscribeToFeed(db, userId, url);
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
        const { body, db, logger, userId } = v1HandlerContext(context);
        const feedIds =
          typeof body === "object" &&
          body !== null &&
          "feedIds" in body &&
          Array.isArray((body as { feedIds: unknown }).feedIds)
            ? (body as { feedIds: string[] }).feedIds
            : [];
        const result = await bulkUnsubscribeFromFeeds(db, userId, feedIds);
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
        const { body, db, logger, userId } = v1HandlerContext(context);
        const raw =
          typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
        const feedIds = Array.isArray(raw.feedIds) ? (raw.feedIds as string[]) : [];
        const folderId = typeof raw.folderId === "string" ? raw.folderId : "";
        const result = await bulkMoveFeedsToFolder(db, userId, feedIds, folderId);
        logger.info("feeds.folder.bulk_move", {
          userId,
          folderId,
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
      "/feeds/:feedId",
      async (context) => {
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
        const { body, db, logger, params, userId } = v1HandlerContext(context);
        const patch =
          typeof body === "object" && body !== null
            ? (body as { customTitle?: string | null })
            : {};
        const result = await updateFeedSubscriptionSettings(db, userId, params.feedId, patch);
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
        const { body, db, logger, params, userId } = v1HandlerContext(context);
        assertFeedAdminUser(userId);
        const patch =
          typeof body === "object" && body !== null ? (body as AdminUpdateGlobalFeedBody) : {};
        const detail = await adminUpdateGlobalFeed(db, params.feedId, patch);
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
        assertFeedAdminUser(userId);
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
        const { db, logger, set, userId, params } = v1HandlerContext(context);
        await assertUserSubscribedToFeed(db, userId, params.feedId);
        try {
          const redis = getRedis();
          const jobId = await publishJob(redis, {
            type: "feed.refresh",
            payload: { feedId: params.feedId, userId },
          });
          logger.info("queue.job.enqueued", {
            jobId,
            jobType: "feed.refresh",
            feedId: params.feedId,
            userId,
          });
          set.status = 202;
          return {
            accepted: true as const,
            jobId,
            type: "feed.refresh" as const,
          };
        } catch (error) {
          logger.error("queue.job.enqueue.failed", {
            feedId: params.feedId,
            userId,
            error: error instanceof Error ? error.message : String(error),
          });
          throw new AppError("Failed to enqueue feed refresh", {
            status: 503,
            code: "QUEUE_UNAVAILABLE",
          });
        }
      },
      { params: t.Object({ feedId: uuidParam }) },
    );
}
