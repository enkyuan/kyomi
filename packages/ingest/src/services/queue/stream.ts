import type Redis from "ioredis";
import {
  fieldsForJob,
  parseJobMessageFields,
  toRedisStreamFieldList,
  type JobMessage,
} from "./job";

/**
 * Redis Streams protocol for job consumers: group creation, claiming, reading, acknowledging and
 * the retry / dead-letter hand-off. Plain Promise functions over one ioredis client; the consume
 * loop, concurrency, backoff and shutdown belong to the caller.
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

/** Put a failed job back at the tail of its stream with the failure recorded as `last_error`. */
export async function requeueJob(
  redis: Redis,
  target: StreamTarget,
  message: JobMessage,
  error: string,
): Promise<void> {
  await moveEntry(redis, target, message.id, {
    streamKey: target.streamKey,
    fields: fieldsForJob(message.job, { attempts: message.attempts + 1, lastError: error }),
  });
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
