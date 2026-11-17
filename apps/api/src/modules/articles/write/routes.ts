import type { Elysia } from "elysia";
import type { ManagedRuntime } from "effect";
import type { Db } from "@adapters/db/service";
import type { AppLogger } from "@adapters/logger/service";
import type { JobQueue } from "@adapters/queue/service";
import { runEffect } from "@shared/http/effect/bridge";
import { v1EffectContext } from "@shared/http/v1/context";
import { createArticleClip } from "./clips/operations";
import {
  articleDetailSchema,
  articleIdParamsSchema,
  brokenArticleReportBodySchema,
  createClipBodySchema,
  messageResponseSchema,
  updateArticleBodySchema,
} from "../schemas";
import { createBrokenArticleReport } from "./reports";
import { recordArticleViewForUser, updateArticleOrClipForUser } from "./update";

type WriteRuntime = ManagedRuntime.ManagedRuntime<Db | AppLogger | JobQueue, unknown>;

export function registerArticleWriteRoutes(app: Elysia, runtime: WriteRuntime) {
  return app
    .post(
      "/articles",
      async (context) => {
        const { body, request, requestId, set, userId } = v1EffectContext<{
          url: string;
          title?: string;
          content?: string;
          note?: string;
        }>(context);
        const detail = await runEffect(
          { runtime, request, requestId, userId },
          createArticleClip(userId, {
            url: body.url,
            title: body.title,
            content: body.content,
            note: body.note,
          }),
        );
        set.status = 201;
        return detail;
      },
      {
        body: createClipBodySchema,
        response: {
          201: articleDetailSchema,
        },
      },
    )
    .post(
      "/articles/:articleId/view",
      async (context) => {
        const { params, request, requestId, userId } = v1EffectContext<
          unknown,
          Record<string, unknown>,
          { articleId: string }
        >(context);
        await runEffect(
          { runtime, request, requestId, userId },
          recordArticleViewForUser(userId, params.articleId),
        );
        return { message: "Article view recorded" };
      },
      {
        params: articleIdParamsSchema,
        response: { 200: messageResponseSchema },
      },
    )
    .post(
      "/articles/:articleId/reports/broken",
      async (context) => {
        const { body, params, request, requestId, userId } = v1EffectContext<
          {
            reason?: "broken_article" | "missing_content" | "wrong_content" | "feed_error";
            details?: string | null;
          },
          Record<string, unknown>,
          { articleId: string }
        >(context);
        await runEffect(
          { runtime, request, requestId, userId },
          createBrokenArticleReport(userId, params.articleId, body),
        );
        return { message: "Broken article report submitted" };
      },
      {
        params: articleIdParamsSchema,
        body: brokenArticleReportBodySchema,
        response: { 200: messageResponseSchema },
      },
    )
    .put(
      "/articles/:articleId",
      async (context) => {
        const { body, params, request, requestId, userId } = v1EffectContext<
          Record<string, unknown>,
          Record<string, unknown>,
          { articleId: string }
        >(context);
        await runEffect(
          { runtime, request, requestId, userId },
          updateArticleOrClipForUser(userId, params.articleId, body),
        );
        return { message: "Article updated" };
      },
      {
        params: articleIdParamsSchema,
        body: updateArticleBodySchema,
        response: { 200: messageResponseSchema },
      },
    );
}
