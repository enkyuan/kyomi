import type Redis from "ioredis";
import {
  fieldsForJob,
  parseJobMessageFields,
  toRedisStreamFieldList,
  type JobMessage,
} from "./job";

/**
 * Redis Streams protocol for job consumers: group creation, claiming, reading, acknowledging and
 * the retry / dead-letter hand-off, including the sorted set that holds a failed job until its
 * retry is due. Plain Promise functions over one ioredis client; the consume loop, concurrency,
 * how long a retry waits and shutdown belong to the caller.
 */

/** One stream entry as ioredis returns it: its id and the flat `[field, value, ...]` list. */
export type StreamEntry = [id: string, fields: string[]];

/** Where a failed job goes: back onto its stream, or onto the dead-letter stream. */
export type StreamTarget = {
  streamKey: string;
  group: string;
  deadLetterStreamKey: string;
  /** Approximate `MAXLEN` applied to the stream a job is moved onto. */
  streamMaxLength: number;
};

export function streamFieldsToRecord(fields: string[]): Record<string, string> {
  if (fields.length % 2 !== 0) {
    throw new Error("Redis stream message fields must be key/value pairs");
  }

  const out: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    out[fields[i]!] = fields[i + 1]!;
  }
  return out;
}

/** Parse a stream entry into a job message. Throws when the entry is not a valid job. */
export function parseStreamEntry([id, fields]: StreamEntry): JobMessage {
  return parseJobMessageFields(id, streamFieldsToRecord(fields));
}

/** Create the consumer group (and the stream) when missing. An existing group is not an error. */
export async function ensureConsumerGroup(
  redis: Redis,
  group: string,
  streamKey: string,
): Promise<void> {
  try {
    await redis.xgroup("CREATE", streamKey, group, "0", "MKSTREAM");
  } catch (error) {
    // Redis reports an existing group as an error reply whose text starts with `BUSYGROUP`.
    if (!(error instanceof Error && error.message.startsWith("BUSYGROUP"))) {
      throw error;
    }
  }
}

/** Take over entries another consumer left pending for at least `minIdleMs` (XAUTOCLAIM). */
export async function claimPendingEntries(
  redis: Redis,
  options: { streamKey: string; group: string; consumer: string; minIdleMs: number; count: number },
): Promise<StreamEntry[]> {
  const response = (await redis.call(
    "XAUTOCLAIM",
    options.streamKey,
    options.group,
    options.consumer,
    String(options.minIdleMs),
    "0-0",
    "COUNT",
    String(options.count),
  )) as [string, StreamEntry[]];

  return response[1] ?? [];
}

/** Read new entries for this consumer, blocking up to `blockMs` (XREADGROUP). */
export async function readNewEntries(
  redis: Redis,
  options: { streamKey: string; group: string; consumer: string; count: number; blockMs: number },
): Promise<StreamEntry[]> {
  const response = (await redis.xreadgroup(
    "GROUP",
    options.group,
    options.consumer,
    "COUNT",
    options.count,
    "BLOCK",
    options.blockMs,
    "STREAMS",
    options.streamKey,
    ">",
  )) as [[string, StreamEntry[]]] | null;

  return response?.[0]?.[1] ?? [];
}

export async function ackEntry(redis: Redis, target: StreamTarget, id: string): Promise<void> {
  await redis.xack(target.streamKey, target.group, id);
}

/** XADD to `destination` and XACK the source entry atomically, failing on any queued error. */
async function moveEntry(
  redis: Redis,
  target: StreamTarget,
  id: string,
  destination: { streamKey: string; fields: Record<string, string> },
): Promise<void> {
  const results = await redis
    .multi()
    .xadd(
      destination.streamKey,
      "MAXLEN",
      "~",
      String(target.streamMaxLength),
      "*",
      ...toRedisStreamFieldList(destination.fields),
    )
    .xack(target.streamKey, target.group, id)
    .exec();

  const failed = results?.find(([error]) => error !== null);
  if (failed?.[0]) {
    throw failed[0];
  }
}

/** The sorted set holding a stream's retries until they are due: member = job, score = due time. */
export function retryKeyFor(streamKey: string): string {
  return `${streamKey}:retry`;
}

/**
 * Park a failed job in the stream's retry set until `dueAtMs` instead of putting it straight back
 * on the stream, and acknowledge the entry, in one transaction. The job is in exactly one place at
 * all times, so a crash cannot lose it or run it twice. `promoteDueRetries` puts it back on the
 * stream once it is due.
 *
 * The member carries the original entry id so two failed jobs with identical fields stay two
 * members instead of collapsing into one.
 */
export async function scheduleRetry(
  redis: Redis,
  target: StreamTarget,
  message: JobMessage,
  error: string,
  dueAtMs: number,
): Promise<void> {
  const fields = toRedisStreamFieldList(
    fieldsForJob(message.job, { attempts: message.attempts + 1, lastError: error }),
  );
  const results = await redis
    .multi()
    .zadd(retryKeyFor(target.streamKey), dueAtMs, JSON.stringify({ id: message.id, fields }))
    .xack(target.streamKey, target.group, message.id)
    .exec();

  const failed = results?.find(([commandError]) => commandError !== null);
  if (failed?.[0]) {
    throw failed[0];
  }
}

/**
 * Moves every retry due at `nowMs` or earlier onto the stream, oldest first and at most `limit` at
 * a time. One script does the whole move (read the due members, XADD each, remove it), so
 * consumers promoting at the same moment never put the same job on the stream twice.
 */
const PROMOTE_DUE_RETRIES = `
local due = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, ARGV[3])
for _, member in ipairs(due) do
  local job = cjson.decode(member)
  redis.call('XADD', KEYS[2], 'MAXLEN', '~', ARGV[2], '*', unpack(job.fields))
  redis.call('ZREM', KEYS[1], member)
end
return #due
`;

/** Put the retries that are due back on the stream. Returns how many were moved. */
export async function promoteDueRetries(
  redis: Redis,
  target: StreamTarget,
  nowMs: number,
  limit = 100,
): Promise<number> {
  const moved = await redis.eval(
    PROMOTE_DUE_RETRIES,
    2,
    retryKeyFor(target.streamKey),
    target.streamKey,
    String(nowMs),
    String(target.streamMaxLength),
    String(limit),
  );
  return Number(moved);
}

/** How many failed jobs are waiting in the retry set for their delay to pass. */
export async function countScheduledRetries(redis: Redis, streamKey: string): Promise<number> {
  return redis.zcard(retryKeyFor(streamKey));
}

/**
 * Move a job that will not be retried onto the dead-letter stream. The failure is stored as both
 * `last_error` (the retry protocol) and `error` (what the dead-letter listing reads).
 */
export async function deadLetterJob(
  redis: Redis,
  target: StreamTarget,
  message: JobMessage,
  error: string,
  now: Date = new Date(),
): Promise<void> {
  await moveEntry(redis, target, message.id, {
    streamKey: target.deadLetterStreamKey,
    fields: {
      ...fieldsForJob(message.job, { attempts: message.attempts + 1, lastError: error }),
      error,
      failed_at: now.toISOString(),
      original_stream_id: message.id,
    },
  });
}

/** Dead-letter an entry that is not a parseable job, keeping its raw fields for inspection. */
export async function deadLetterRawEntry(
  redis: Redis,
  target: StreamTarget,
  [id, fields]: StreamEntry,
  error: string,
  now: Date = new Date(),
): Promise<void> {
  const base =
    fields.length % 2 === 0 ? streamFieldsToRecord(fields) : { raw_fields: JSON.stringify(fields) };
  await moveEntry(redis, target, id, {
    streamKey: target.deadLetterStreamKey,
    fields: {
      ...base,
      attempts: base.attempts ?? "0",
      error,
      failed_at: now.toISOString(),
      original_stream_id: id,
    },
  });
}
