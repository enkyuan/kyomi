import type { Elysia } from "elysia";
import type { ManagedRuntime } from "effect";
import type { Db } from "@adapters/db/service";
import type { AppLogger } from "@adapters/logger/service";
import type { JobQueue } from "@adapters/queue/service";
import { enforceRateLimitForContext } from "@adapters/rate-limit/plugin";
import type { AppConfig } from "@config/env/service";
import { parseSupportedDocumentVersion } from "@modules/articles/document/negotiate";
import { runEffect } from "@shared/http/effect/bridge";
import { v1EffectContext } from "@shared/http/v1/context";
import { extractArticleFullText, summarizeArticle, translateArticle } from "./operations";
import {
  articleIdParamsSchema,
  extractFullTextResponseSchema,
  summarizeBodySchema,
  summarizeResponseSchema,
  translateBodySchema,
  translateResponseSchema,
} from "../schemas";

/** Each of these fetches a page or calls a paid model on the user's behalf. */
// The web client extracts the full text of every article it opens by default, so a reader going
// through an inbox makes many of these legitimately; this bounds a script, not a person.
const extractRateLimit = { name: "articles.extract", max: 120, windowMs: 10 * 60_000 } as const;
const summarizeRateLimit = { name: "articles.summarize", max: 30, windowMs: 10 * 60_000 } as const;
const translateRateLimit = { name: "articles.translate", max: 30, windowMs: 10 * 60_000 } as const;

type ArticleEnrichmentRuntime = ManagedRuntime.ManagedRuntime<
  Db | AppLogger | AppConfig | JobQueue,
  unknown
>;

export function registerArticleEnrichmentRoutes(app: Elysia, runtime: ArticleEnrichmentRuntime) {
  return app
    .post(
      "/articles/:articleId/extract-full-text",
      async (context) => {
        const { params, request, requestId, userId } = v1EffectContext<
          unknown,
          Record<string, unknown>,
          { articleId: string }
        >(context);
        await enforceRateLimitForContext(context, userId, extractRateLimit);
        return runEffect(
          { runtime, request, requestId, userId },
          extractArticleFullText(params.articleId, {
            maxVersion: parseSupportedDocumentVersion(request.headers),
          }),
        );
      },
      {
        params: articleIdParamsSchema,
        response: { 200: extractFullTextResponseSchema },
      },
    )
    .post(
      "/articles/:articleId/summarize",
      async (context) => {
        const { body, params, request, requestId, userId } = v1EffectContext<
          { content?: string; language_key?: string },
          Record<string, unknown>,
          { articleId: string }
        >(context);
        await enforceRateLimitForContext(context, userId, summarizeRateLimit);
        return runEffect(
          { runtime, request, requestId, userId },
          summarizeArticle(params.articleId, body),
        );
      },
      {
        params: articleIdParamsSchema,
        body: summarizeBodySchema,
        response: { 200: summarizeResponseSchema },
      },
    )
    .post(
      "/articles/:articleId/translate",
      async (context) => {
        const { body, params, request, requestId, userId } = v1EffectContext<
          { content?: string; target_language: string },
          Record<string, unknown>,
          { articleId: string }
        >(context);
        await enforceRateLimitForContext(context, userId, translateRateLimit);
        return runEffect(
          { runtime, request, requestId, userId },
          translateArticle(params.articleId, body),
        );
      },
      {
        params: articleIdParamsSchema,
        body: translateBodySchema,
        response: { 200: translateResponseSchema },
      },
    );
}
