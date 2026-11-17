import type { Elysia } from "elysia";
import { t } from "elysia";
import { runEffect } from "@shared/http/effect/bridge";
import { v1EffectContext } from "@shared/http/v1/context";
import { uuidParam } from "@shared/http/v1/params";
import type { FeedsRuntime } from "../runtime";
import { adminDeleteGlobalFeed, adminUpdateGlobalFeed } from "./operations";
import type { AdminUpdateGlobalFeedBody } from "../types";
import * as dto from "../schemas";

export function registerFeedAdminRoutes(app: Elysia, runtime: FeedsRuntime) {
  return app
    .put(
      "/feeds/:feedId/admin",
      (context) => {
        const { body, params, request, requestId, userId } = v1EffectContext<
          AdminUpdateGlobalFeedBody,
          Record<string, unknown>,
          { feedId: string }
        >(context);
        return runEffect(
          { runtime, request, requestId, userId },
          adminUpdateGlobalFeed(userId, request.headers, params.feedId, body),
        );
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
      (context) => {
        const { params, request, requestId, userId } = v1EffectContext(context);
        return runEffect(
          { runtime, request, requestId, userId },
          adminDeleteGlobalFeed(userId, request.headers, params.feedId),
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
