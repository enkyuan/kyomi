import { Effect } from "effect";
import {
  FEED_REFRESH_JOBS_STREAM_KEY,
  JOBS_CONSUMER_GROUP,
  OPML_JOBS_STREAM_KEY,
  countScheduledRetries,
} from "@kyomi/ingest";
import { Redis } from "@adapters/redis/service";
import { RedisError } from "@shared/effect/errors";
import type { QueueHealthSnapshot } from "./types";

const STREAM_KEYS = [FEED_REFRESH_JOBS_STREAM_KEY, OPML_JOBS_STREAM_KEY];

/** `XPENDING key group` summary reply: `[count, minId, maxId, consumers]`. */
function pendingCount(reply: unknown): Effect.Effect<number, RedisError> {
  if (Array.isArray(reply) && typeof reply[0] === "number") {
    return Effect.succeed(reply[0]);
  }
  return Effect.fail(
    new RedisError({ operation: "xpending", cause: new Error("unexpected XPENDING reply") }),
  );
}

/**
 * Length, pending and scheduled-retry counts per job stream. A missing consumer group (`NOGROUP`) has nothing
 * pending; any other Redis failure fails the snapshot instead of reporting zero.
 */
export const queueHealth: Effect.Effect<QueueHealthSnapshot, RedisError, Redis> = Effect.gen(
  function* () {
    const redis = yield* Redis;
    const entries = yield* Effect.forEach(
      STREAM_KEYS,
      (streamKey) =>
        Effect.all({
          length: redis.use("xlen", (client) => client.xlen(streamKey)),
          scheduled: redis.use("zcard", (client) => countScheduledRetries(client, streamKey)),
          pending: redis
            .use("xpending", (client) => client.xpending(streamKey, JOBS_CONSUMER_GROUP))
            .pipe(
              Effect.flatMap(pendingCount),
              Effect.catchIf(
                (error) => error.code === "NOGROUP",
                () => Effect.succeed(0),
              ),
            ),
        }).pipe(Effect.map((counts) => [streamKey, counts] as const)),
      { concurrency: "unbounded" },
    );
    return { streams: Object.fromEntries(entries) };
  },
);
