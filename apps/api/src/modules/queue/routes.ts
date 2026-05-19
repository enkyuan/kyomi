import type { Elysia } from "elysia";
import { t } from "elysia";
import { getRedis } from "@adapters/redis";
import {
  JOBS_DEAD_LETTER_STREAM_KEY,
  JOBS_STREAM_KEY,
  fieldsForJob,
  parseJobMessageFields,
  toRedisStreamFieldList,
} from "@vols.rss/worker";
import { v1HandlerContext } from "@shared/http/v1-handler-context";
import { assertFeedAdminUser } from "@modules/feeds/admin/guard";

const deadLetterItem = t.Object({
  id: t.String(),
  type: t.String(),
  attempts: t.Number(),
  error: t.Union([t.String(), t.Null()]),
  failedAt: t.Union([t.String(), t.Null()]),
  originalStreamId: t.Union([t.String(), t.Null()]),
  payload: t.String(),
});

const replayBody = t.Object({
  ids: t.Array(t.String(), { minItems: 1 }),
});

export function registerQueueRoutes(app: Elysia) {
  return app
    .get(
      "/queue/dead-letter",
      async (context) => {
        const { logger, query, userId } = v1HandlerContext<unknown, { limit?: number }>(context);
        assertFeedAdminUser(userId, context.request.headers);
        const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25) || 25));
        const redis = getRedis();
        const rows = (await redis.xrevrange(
          JOBS_DEAD_LETTER_STREAM_KEY,
          "+",
          "-",
          "COUNT",
          limit,
        )) as [string, string[]][];

        const items = rows.map(([id, fields]) => {
          const record = Object.fromEntries(
            fields.reduce<string[][]>((pairs, value, index, all) => {
              if (index % 2 === 0 && index + 1 < all.length) {
                pairs.push([value, all[index + 1] ?? ""]);
              }
              return pairs;
            }, []),
          );

          return {
            id,
            type: record.type ?? "unknown",
            attempts: Number(record.attempts ?? "0") || 0,
            error: record.error ?? null,
            failedAt: record.failed_at ?? null,
            originalStreamId: record.original_stream_id ?? null,
            payload: record.payload ?? "{}",
          };
        });

        logger.info("queue.dead_letter.listed", {
          userId,
          count: items.length,
        });
        return items;
      },
      {
        query: t.Object({
          limit: t.Optional(t.Numeric()),
        }),
        response: {
          200: t.Array(deadLetterItem),
        },
      },
    )
    .post(
      "/queue/dead-letter/replay",
      async (context) => {
        const { body, logger, userId } = v1HandlerContext<{ ids: string[] }>(context);
        assertFeedAdminUser(userId, context.request.headers);
        const redis = getRedis();
        const ids = body.ids;

        let replayed = 0;
        for (const id of ids) {
          const rows = (await redis.xrange(JOBS_DEAD_LETTER_STREAM_KEY, id, id)) as [
            string,
            string[],
          ][];
          const row = rows[0];
          if (!row) {
            continue;
          }
          const [entryId, fields] = row;
          const record = Object.fromEntries(
            fields.reduce<string[][]>((pairs, value, index, all) => {
              if (index % 2 === 0 && index + 1 < all.length) {
                pairs.push([value, all[index + 1] ?? ""]);
              }
              return pairs;
            }, []),
          );
          const message = parseJobMessageFields(entryId, record);
          await redis.xadd(
            JOBS_STREAM_KEY,
            "*",
            ...toRedisStreamFieldList(
              fieldsForJob(message.job, {
                attempts: 0,
              }),
            ),
          );
          await redis.xdel(JOBS_DEAD_LETTER_STREAM_KEY, id);
          replayed += 1;
        }

        logger.info("queue.dead_letter.replayed", {
          userId,
          requested: ids.length,
          replayed,
        });

        return {
          message: `Replayed ${replayed} dead-letter job(s)`,
          replayed,
        };
      },
      {
        body: replayBody,
        response: {
          200: t.Object({
            message: t.String(),
            replayed: t.Number(),
          }),
        },
      },
    );
}
