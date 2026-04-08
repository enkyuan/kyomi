import type Redis from "ioredis";

export const JOBS_STREAM_KEY = "jobs";
export const JOBS_CONSUMER_GROUP = "cronos-workers";
export const JOBS_DEAD_LETTER_STREAM_KEY = "jobs:dead-letter";

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
  attempts: number;
  rawFields: Record<string, string>;
};

export function fieldsForJob(
  job: Job,
  metadata?: { attempts?: number; lastError?: string | null },
): Record<string, string> {
  const fields: Record<string, string> = {
    type: job.type,
    payload: JSON.stringify(job.payload),
  };
  if (metadata?.attempts !== undefined) {
    fields.attempts = String(metadata.attempts);
  }
  if (metadata?.lastError) {
    fields.last_error = metadata.lastError;
  }
  return fields;
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

export function parseJobMessageFields(id: string, fields: Record<string, string>): JobMessage {
  const attemptsRaw = Number(fields.attempts ?? "0");
  const attempts = Number.isFinite(attemptsRaw) && attemptsRaw >= 0 ? attemptsRaw : 0;
  return {
    id,
    job: parseJob(fields),
    attempts,
    rawFields: fields,
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
  maxAttempts?: number;
  retryDelayMs?: number;
  pendingMinIdleMs?: number;
  deadLetterStreamKey?: string;
  signal?: AbortSignal;
  onJob: (message: JobMessage) => Promise<void>;
  onError?: (error: unknown, message: JobMessage | null) => Promise<void> | void;
};

async function retryOrDeadLetterJob(
  redis: Redis,
  options: {
    streamKey: string;
    group: string;
    deadLetterStreamKey: string;
    message: JobMessage;
    error: unknown;
    maxAttempts: number;
    retryDelayMs: number;
    signal?: AbortSignal;
  },
): Promise<void> {
  const {
    streamKey,
    group,
    deadLetterStreamKey,
    message,
    error,
    maxAttempts,
    retryDelayMs,
    signal,
  } = options;
  const nextAttempts = message.attempts + 1;
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (nextAttempts <= maxAttempts) {
    if (retryDelayMs > 0 && !signal?.aborted) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, retryDelayMs);
        signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    await redis.xadd(
      streamKey,
      "*",
      ...toRedisStreamFieldList(
        fieldsForJob(message.job, {
          attempts: nextAttempts,
          lastError: errorMessage,
        }),
      ),
    );
  } else {
    const deadLetterFields = {
      ...message.rawFields,
      attempts: String(nextAttempts),
      error: errorMessage,
      failed_at: new Date().toISOString(),
      original_stream_id: message.id,
    };
    await redis.xadd(deadLetterStreamKey, "*", ...toRedisStreamFieldList(deadLetterFields));
  }

  await redis.xack(streamKey, group, message.id);
}

async function claimPendingJobs(
  redis: Redis,
  options: {
    streamKey: string;
    group: string;
    consumer: string;
    pendingMinIdleMs: number;
    count: number;
  },
): Promise<[string, string[]][]> {
  const response = (await redis.call(
    "XAUTOCLAIM",
    options.streamKey,
    options.group,
    options.consumer,
    options.pendingMinIdleMs,
    "0-0",
    "COUNT",
    options.count,
  )) as [string, [string, string[]][]];

  return Array.isArray(response?.[1]) ? response[1] : [];
}

async function processMessage(
  redis: Redis,
  options: {
    streamKey: string;
    group: string;
    deadLetterStreamKey: string;
    maxAttempts: number;
    retryDelayMs: number;
    signal?: AbortSignal;
    onJob: (message: JobMessage) => Promise<void>;
    onError?: (error: unknown, message: JobMessage | null) => Promise<void> | void;
  },
  id: string,
  fields: string[],
): Promise<void> {
  let message: JobMessage | null = null;
  try {
    message = parseJobMessageFields(id, streamFieldsToRecord(fields));
    await options.onJob(message);
    await redis.xack(options.streamKey, options.group, id);
  } catch (error) {
    if (message) {
      await retryOrDeadLetterJob(redis, {
        streamKey: options.streamKey,
        group: options.group,
        deadLetterStreamKey: options.deadLetterStreamKey,
        message,
        error,
        maxAttempts: options.maxAttempts,
        retryDelayMs: options.retryDelayMs,
        signal: options.signal,
      });
    } else {
      // Parsing failed — dead-letter the raw message so it is not stuck in the PEL forever.
      const rawFields = streamFieldsToRecord(fields);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const deadLetterFields = {
        ...rawFields,
        attempts: rawFields.attempts ?? "0",
        error: errorMessage,
        failed_at: new Date().toISOString(),
        original_stream_id: id,
      };
      await redis.xadd(
        options.deadLetterStreamKey,
        "*",
        ...toRedisStreamFieldList(deadLetterFields),
      );
      await redis.xack(options.streamKey, options.group, id);
    }
    await options.onError?.(error, message);
  }
}

export async function consumeJobs(redis: Redis, options: ConsumeJobsOptions): Promise<void> {
  const {
    consumer,
    onJob,
    onError,
    signal,
    blockMs = 5_000,
    count = 1,
    maxAttempts = 3,
    retryDelayMs = 0,
    pendingMinIdleMs = 30_000,
    deadLetterStreamKey = JOBS_DEAD_LETTER_STREAM_KEY,
    group = JOBS_CONSUMER_GROUP,
    streamKey = JOBS_STREAM_KEY,
  } = options;

  await ensureConsumerGroup(redis, group, streamKey);

  while (!signal?.aborted) {
    const pendingMessages = await claimPendingJobs(redis, {
      streamKey,
      group,
      consumer,
      pendingMinIdleMs,
      count,
    }).catch(async (error) => {
      await onError?.(error, null);
      return [];
    });

    if (pendingMessages.length > 0) {
      for (const [id, fields] of pendingMessages) {
        await processMessage(
          redis,
          {
            streamKey,
            group,
            deadLetterStreamKey,
            maxAttempts,
            retryDelayMs,
            signal,
            onJob,
            onError,
          },
          id,
          fields,
        );
      }
      continue;
    }

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
      await processMessage(
        redis,
        {
          streamKey,
          group,
          deadLetterStreamKey,
          maxAttempts,
          retryDelayMs,
          signal,
          onJob,
          onError,
        },
        id,
        fields,
      );
    }
  }
}
