import type { Elysia } from "elysia";
import type { ManagedRuntime } from "effect";
import type { Db } from "@adapters/db/service";
import type { AppLogger } from "@adapters/logger/service";
import type { AppConfig } from "@config/env/service";
import { enforceRateLimitForContext } from "@adapters/rate-limit/plugin";
import { runEffect } from "@shared/http/effect/bridge";
import { v1EffectContext } from "@shared/http/v1/context";
import { articleIdParamsSchema } from "../schemas";
import { writeArticleProgressForUser } from "./operations";
import { readingProgressResponseSchema, readingProgressUpdateBodySchema } from "./schemas";
import type { ReadingProgressUpdateBody } from "./types";

type ProgressRuntime = ManagedRuntime.ManagedRuntime<Db | AppLogger | AppConfig, unknown>;

/** Clients flush every 10 s per open article; this leaves room for several devices and retries. */
const readingProgressWriteRateLimit = {
  name: "articles.progress.write",
  max: 120,
  windowMs: 60_000,
} as const;

export function registerArticleProgressRoutes(app: Elysia, runtime: ProgressRuntime) {
  return app.put(
    "/articles/:articleId/progress",
    async (context) => {
      const { body, params, request, requestId, userId } = v1EffectContext<
        ReadingProgressUpdateBody,
        Record<string, unknown>,
        { articleId: string }
      >(context);
      await enforceRateLimitForContext(context, userId, readingProgressWriteRateLimit);
      const readingProgress = await runEffect(
        { runtime, request, requestId, userId },
        writeArticleProgressForUser(
          userId,
          params.articleId,
          body,
          request.headers.has("x-kyomi-offline-owner"),
        ),
      );
      return { readingProgress };
    },
    {
      params: articleIdParamsSchema,
      body: readingProgressUpdateBodySchema,
      response: { 200: readingProgressResponseSchema },
    },
  );
}
