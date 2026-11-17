import { Effect } from "effect";
import {
  JOBS_DEAD_LETTER_STREAM_KEY,
  parseJobMessageFields,
  streamFieldsToRecord,
  type Job,
} from "@kyomi/ingest";
import { AppLogger } from "@adapters/logger/service";
import { JobQueue } from "@adapters/queue/service";
import { Redis } from "@adapters/redis/service";
import { CurrentUser } from "@shared/effect/request";
import { unexpected } from "@shared/effect/errors";
import { requireFeedAdmin as requireFeedAdminUser } from "@modules/feeds/admin/guard";
import type { DeadLetterItem } from "./types";

type StreamRow = [id: string, fields: string[]];

/** The feed-admin allowlist or shared secret gate, as a typed failure. */
export const requireFeedAdmin = (headers: Headers) =>
  Effect.gen(function* () {
    const { userId } = yield* CurrentUser;
    yield* requireFeedAdminUser(userId, headers);
  });

function toDeadLetterItem([id, fields]: StreamRow): DeadLetterItem {
  const record = streamFieldsToRecord(fields);
  return {
    id,
    type: record.type ?? "unknown",
    attempts: Number(record.attempts ?? "0") || 0,
    // `error` is what dead-lettering writes today; entries from before it also carried `last_error`.
    error: record.error ?? record.last_error ?? null,
    failedAt: record.failed_at ?? null,
    originalStreamId: record.original_stream_id ?? null,
    payload: record.payload ?? "{}",
  };
}

/** The newest `limit` dead-lettered jobs, newest first. */
export const listDeadLetters = Effect.fn("queue.deadLetter.list")(function* (limit: number) {
  const redis = yield* Redis;
  const log = yield* AppLogger;
  const { userId } = yield* CurrentUser;

  const rows = (yield* redis.use("xrevrange", (client) =>
    client.xrevrange(JOBS_DEAD_LETTER_STREAM_KEY, "+", "-", "COUNT", limit),
  )) as StreamRow[];
  const items = rows.map(toDeadLetterItem);

  yield* log.info("queue.dead_letter.listed", { userId, count: items.length });
  return items;
});

function parseDeadLetteredJob([id, fields]: StreamRow): Effect.Effect<
  Job,
  ReturnType<typeof unexpected>
> {
  return Effect.try({
    try: () => parseJobMessageFields(id, streamFieldsToRecord(fields)).job,
    catch: unexpected,
  });
}

/** Publish the given dead-lettered jobs again and remove them from the dead-letter stream. */
export const replayDeadLetters = Effect.fn("queue.deadLetter.replay")(function* (
  ids: ReadonlyArray<string>,
) {
  const redis = yield* Redis;
  const queue = yield* JobQueue;
  const log = yield* AppLogger;
  const { userId } = yield* CurrentUser;

  let replayed = 0;
  for (const id of ids) {
    const rows = (yield* redis.use("xrange", (client) =>
      client.xrange(JOBS_DEAD_LETTER_STREAM_KEY, id, id),
    )) as StreamRow[];
    const row = rows[0];
    if (!row) {
      continue;
    }
    yield* queue.publish(yield* parseDeadLetteredJob(row));
    yield* redis.use("xdel", (client) => client.xdel(JOBS_DEAD_LETTER_STREAM_KEY, id));
    replayed += 1;
  }

  yield* log.info("queue.dead_letter.replayed", { userId, requested: ids.length, replayed });
  return { message: `Replayed ${replayed} dead-letter job(s)`, replayed };
});
