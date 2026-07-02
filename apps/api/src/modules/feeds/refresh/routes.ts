import type { Elysia } from "elysia";
import { t } from "elysia";
import { v1HandlerContext } from "@shared/http/v1/context";
import { uuidParam } from "@shared/http/v1/stub";
import { listFeedRefreshStatusesForUser } from "../read/service";
import * as schemas from "../schemas";
import { assertUserSubscribedToFeed } from "../subscription/mutations";
import {
  enqueueBatchFeedRefresh,
  enqueueFeedRefresh,
  listRefreshableFeedIdsForUser,
} from "./service";

export function registerFeedRefreshRoutes(app: Elysia) {
  return app
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
          200: schemas.feedRefreshStatusListResponse,
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
