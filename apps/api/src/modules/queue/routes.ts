import { Effect, type ManagedRuntime } from "effect";
import type { Elysia } from "elysia";
import { t } from "elysia";
import type { AppLogger } from "@adapters/logger/service";
import type { JobQueue } from "@adapters/queue/service";
import type { Redis } from "@adapters/redis/service";
import type { CurrentUser, RequestContext } from "@shared/effect/request";
import { runEffect } from "@shared/http/effect/bridge";
import { v1HandlerContext } from "@shared/http/v1/context";
import { listDeadLetters, replayDeadLetters, requireFeedAdmin } from "./operations";
import { deadLetterItem, deadLetterListQuery, replayBody, replayResponse } from "./schemas";

type QueueServices = Redis | JobQueue | AppLogger;
type QueueRuntime = ManagedRuntime.ManagedRuntime<QueueServices, unknown>;

export function registerQueueRoutes(app: Elysia, runtime: QueueRuntime) {
  /** Run an effect for the authenticated user of this request. */
  const run = <A, E>(
    context: unknown,
    effect: Effect.Effect<A, E, QueueServices | RequestContext | CurrentUser>,
  ) => {
    const { userId } = v1HandlerContext(context);
    const { request, requestId } = context as { request: Request; requestId: string };
    return runEffect({ runtime, request, requestId, userId }, effect);
  };

  return app
    .get(
      "/queue/dead-letter",
      (context) => {
        const { query } = v1HandlerContext<unknown, { limit?: number }>(context);
        const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25) || 25));
        return run(
          context,
          requireFeedAdmin(context.request.headers).pipe(Effect.andThen(listDeadLetters(limit))),
        );
      },
      { query: deadLetterListQuery, response: { 200: t.Array(deadLetterItem) } },
    )
    .post(
      "/queue/dead-letter/replay",
      (context) => {
        const { body } = v1HandlerContext<{ ids: string[] }>(context);
        return run(
          context,
          requireFeedAdmin(context.request.headers).pipe(
            Effect.andThen(replayDeadLetters(body.ids)),
          ),
        );
      },
      { body: replayBody, response: { 200: replayResponse } },
    );
}
