import type Redis from "ioredis";

export const JOBS_STREAM_KEY = "jobs";
export const JOBS_CONSUMER_GROUP = "cronos-workers";

export type FeedRefreshJob = {
  type: "feed.refresh";
  payload: {
    feedId: string;
    userId: string;
  };
};

export type Job = FeedRefreshJob;

export type JobMessage = {
  id: string;
  job: Job;
};

export function fieldsForJob(job: Job): Record<string, string> {
  return {
    type: job.type,
    payload: JSON.stringify(job.payload),
  };
}

export function toRedisStreamFieldList(
  fields: Record<string, string>,
): [string, string, ...string[]] {
  const entries = Object.entries(fields).flatMap(([key, value]) => [key, value]);

  if (entries.length < 2) {
    throw new Error("Redis stream field list requires at least one field");
  }

  return entries as [string, string, ...string[]];
}

export function parseJob(fields: Record<string, string>): Job {
  if (fields.type !== "feed.refresh") {
    throw new Error(`Unsupported job type: ${fields.type ?? "unknown"}`);
  }

  const parsedPayload = JSON.parse(fields.payload ?? "null") as Record<string, unknown> | null;
  if (
    !parsedPayload ||
    typeof parsedPayload.feedId !== "string" ||
    typeof parsedPayload.userId !== "string"
  ) {
    throw new Error("Invalid feed.refresh payload");
  }

  return {
    type: "feed.refresh",
    payload: {
      feedId: parsedPayload.feedId,
      userId: parsedPayload.userId,
    },
  };
}

function streamFieldsToRecord(fields: string[]): Record<string, string> {
  if (fields.length % 2 !== 0) {
    throw new Error("Redis stream message fields must be key/value pairs");
  }

  const out: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    out[fields[i]!] = fields[i + 1]!;
  }
  return out;
}

export async function ensureConsumerGroup(
  redis: Redis,
  group = JOBS_CONSUMER_GROUP,
  streamKey = JOBS_STREAM_KEY,
): Promise<void> {
  try {
    await redis.xgroup("CREATE", streamKey, group, "0", "MKSTREAM");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("BUSYGROUP")) {
      throw error;
    }
  }
}

export type ConsumeJobsOptions = {
  consumer: string;
  group?: string;
  streamKey?: string;
  blockMs?: number;
  count?: number;
  signal?: AbortSignal;
  onJob: (message: JobMessage) => Promise<void>;
  onError?: (error: unknown, message: JobMessage | null) => Promise<void> | void;
};

export async function consumeJobs(redis: Redis, options: ConsumeJobsOptions): Promise<void> {
  const {
    consumer,
    onJob,
    onError,
    signal,
    blockMs = 5_000,
    count = 1,
    group = JOBS_CONSUMER_GROUP,
    streamKey = JOBS_STREAM_KEY,
  } = options;

  await ensureConsumerGroup(redis, group, streamKey);

  while (!signal?.aborted) {
    let response: [[string, [string, string[]][]]] | null;

    try {
      response = (await redis.xreadgroup(
        "GROUP",
        group,
        consumer,
        "COUNT",
        count,
        "BLOCK",
        blockMs,
        "STREAMS",
        streamKey,
        ">",
      )) as [[string, [string, string[]][]]] | null;
    } catch (error) {
      await onError?.(error, null);
      continue;
    }

    if (!response) {
      continue;
    }

    const [, messages] = response[0] ?? [];
    if (!messages) {
      continue;
    }

    for (const [id, fields] of messages) {
      let message: JobMessage | null = null;
      try {
        message = {
          id,
          job: parseJob(streamFieldsToRecord(fields)),
        };
        await onJob(message);
        await redis.xack(streamKey, group, id);
      } catch (error) {
        await onError?.(error, message);
      }
    }
  }
}
