import type { Elysia } from "elysia";
import { enforceRateLimitForContext } from "@adapters/rate-limit/plugin";
import { v1HandlerContext } from "@shared/http/v1/context";
import { articleIdParamsSchema } from "../schemas";
import { readingProgressResponseSchema, readingProgressUpdateBodySchema } from "./schemas";
import type { ReadingProgressUpdateBody } from "./types";
import { writeArticleProgressForUser } from "./write";

/** Clients flush every 10 s per open article; this leaves room for several devices and retries. */
const readingProgressWriteRateLimit = {
  name: "articles.progress.write",
  max: 120,
  windowMs: 60_000,
} as const;

export function registerArticleProgressRoutes(app: Elysia) {
  return app.put(
    "/articles/:articleId/progress",
    async (context) => {
      const { body, db, params, userId } = v1HandlerContext<
        ReadingProgressUpdateBody,
        Record<string, unknown>,
        { articleId: string }
      >(context);
      await enforceRateLimitForContext(context, userId, readingProgressWriteRateLimit);
      const readingProgress = await writeArticleProgressForUser(db, userId, params.articleId, body);
      return { readingProgress };
    },
    {
      params: articleIdParamsSchema,
      body: readingProgressUpdateBodySchema,
      response: { 200: readingProgressResponseSchema },
    },
  );
}
