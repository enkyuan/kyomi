import type { Elysia } from "elysia";
import { t } from "elysia";
import { v1HandlerContext } from "@shared/http/v1/context";
import { uuidParam } from "@shared/http/v1/stub";
import { assertFeedAdminUser } from "./guard";
import { adminDeleteGlobalFeed, adminUpdateGlobalFeed } from "./service";
import type { AdminUpdateGlobalFeedBody } from "../types";
import * as dto from "../dto";

export function registerFeedAdminRoutes(app: Elysia) {
  return app
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
    );
}
