import type { Elysia } from "elysia";
import { t } from "elysia";
import { runEffect } from "@shared/http/effect/bridge";
import { v1EffectContext } from "@shared/http/v1/context";
import { uuidParam } from "@shared/http/v1/params";
import * as dto from "../schemas";
import type { FeedsRuntime } from "../runtime";
import { markAllArticlesReadInFeed } from "./mark";

export function registerFeedReadRoutes(app: Elysia, runtime: FeedsRuntime) {
  return app.put(
    "/feeds/:feedId/read-status",
    (context) => {
      const { params, request, requestId, userId } = v1EffectContext(context);
      return runEffect(
        { runtime, request, requestId, userId },
        markAllArticlesReadInFeed(userId, params.feedId),
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
