import type { Elysia } from "elysia";
import { t } from "elysia";
import { enforceRateLimitForContext } from "@adapters/rate-limit/plugin";
import { runEffect } from "@shared/http/effect/bridge";
import { v1EffectContext } from "@shared/http/v1/context";
import { uuidParam } from "@shared/http/v1/params";
import { listFeedRefreshStatusesForUser } from "../read/queries";
import * as dto from "../schemas";
import type { FeedsRuntime } from "../runtime";
import { refreshFeedForUser, refreshFeedsForUser } from "./operations";

/** Each refresh queues a fetch of someone else's server, so a user may only ask so often. */
const refreshOneRateLimit = { name: "feeds.refresh_one", max: 30, windowMs: 60_000 } as const;
const refreshAllRateLimit = { name: "feeds.refresh_all", max: 6, windowMs: 10 * 60_000 } as const;

export function registerFeedRefreshRoutes(app: Elysia, runtime: FeedsRuntime) {
  return app
    .get(
      "/feeds/refresh-status",
      async (context) => {
        const { query, request, requestId, userId } = v1EffectContext<
          unknown,
          { folder_id?: string }
        >(context);
        const folderId =
          typeof query.folder_id === "string" && query.folder_id.trim().length > 0
            ? query.folder_id.trim()
            : undefined;
        const items = await runEffect(
          { runtime, request, requestId, userId },
          listFeedRefreshStatusesForUser(userId, folderId),
        );
        return { items };
      },
      {
        response: {
          200: dto.feedRefreshStatusListResponse,
        },
      },
    )
    .post(
      "/feeds/:feedId/refresh",
      async (context) => {
        const { params, request, requestId, set, userId } = v1EffectContext(context);
        await enforceRateLimitForContext(context, userId, refreshOneRateLimit);
        const accepted = await runEffect(
          { runtime, request, requestId, userId },
          refreshFeedForUser(userId, params.feedId),
        );
        set.status = 202;
        return accepted;
      },
      { params: t.Object({ feedId: uuidParam }) },
    )
    .post(
      "/feeds/refresh",
      async (context) => {
        const { body, request, requestId, set, userId } = v1EffectContext<{
          folderId?: string;
        }>(context);
        await enforceRateLimitForContext(context, userId, refreshAllRateLimit);
        const result = await runEffect(
          { runtime, request, requestId, userId },
          refreshFeedsForUser(userId, (body || {}).folderId),
        );
        set.status = 202;
        return result;
      },
      {
        body: t.Optional(t.Object({ folderId: t.Optional(uuidParam) })),
      },
    );
}
