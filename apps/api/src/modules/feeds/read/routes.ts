import type { Elysia } from "elysia";
import { t } from "elysia";
import { v1HandlerContext } from "@shared/http/v1/context";
import { uuidParam } from "@shared/http/v1/stub";
import * as dto from "../dto";
import { markAllArticlesReadInFeed } from "./status";

export function registerFeedReadRoutes(app: Elysia) {
  return app.put(
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
  );
}
