import type Redis from "ioredis";

export const FEED_REFRESH_JOBS_STREAM_KEY = "jobs:feed-refresh";
export const OPML_JOBS_STREAM_KEY = "jobs:opml";
export const JOBS_STREAM_KEY = FEED_REFRESH_JOBS_STREAM_KEY;
export const JOBS_CONSUMER_GROUP = "kyomi-workers";
export const JOBS_DEAD_LETTER_STREAM_KEY = "jobs:dead-letter";

export type FeedRefreshJob = {
  type: "feed.refresh";
  payload: {
    feedId: string;
    userId: string;
    reason?: string;
  };
};

export type OpmlImportJob = {
  type: "opml.import";
  payload: {
    taskId: string;
    userId: string;
    xml: string;
    filename: string;
  };
};

export type OpmlImportFeedJob = {
  type: "opml.import.feed";
  payload: {
    taskId: string;
    userId: string;
    url: string;
    title?: string;
    folderId?: string | null;
  };
};

export type Job = FeedRefreshJob | OpmlImportJob | OpmlImportFeedJob;
export type JobType = Job["type"];

export type JobMessage = {
  id: string;
  job: Job;
  attempts: number;
  rawFields: Record<string, string>;
};

export type QueueOptions = {
  streamKey?: string;
  streamMaxLength?: number;
  processConcurrency?: number;
};

export function getStreamKeyForJobType(jobType: JobType): string {
  switch (jobType) {
    case "feed.refresh":
      return FEED_REFRESH_JOBS_STREAM_KEY;
    case "opml.import":
    case "opml.import.feed":
      return OPML_JOBS_STREAM_KEY;
  }
}

export function normalizeQueueOptions(options: QueueOptions = {}) {
  return {
    streamKey: options.streamKey,
    streamMaxLength: Math.min(Math.max(options.streamMaxLength ?? 100_000, 1_000), 5_000_000),
    processConcurrency: Math.min(Math.max(options.processConcurrency ?? 1, 1), 64),
  };
}

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

function parseFeedRefreshJob(parsedPayload: Record<string, unknown>): FeedRefreshJob {
  if (typeof parsedPayload.feedId !== "string" || typeof parsedPayload.userId !== "string") {
    throw new Error("Invalid feed.refresh payload");
  }

  return {
    type: "feed.refresh",
    payload: {
      feedId: parsedPayload.feedId,
      userId: parsedPayload.userId,
      reason: typeof parsedPayload.reason === "string" ? parsedPayload.reason : undefined,
    },
  };
}

function parseOpmlImportJob(parsedPayload: Record<string, unknown>): OpmlImportJob {
  if (
    typeof parsedPayload.taskId !== "string" ||
    typeof parsedPayload.userId !== "string" ||
    typeof parsedPayload.xml !== "string" ||
    typeof parsedPayload.filename !== "string"
  ) {
    throw new Error("Invalid opml.import payload");
  }

  return {
    type: "opml.import",
    payload: {
      taskId: parsedPayload.taskId,
      userId: parsedPayload.userId,
      xml: parsedPayload.xml,
      filename: parsedPayload.filename,
    },
  };
}

function parseOpmlImportFeedJob(parsedPayload: Record<string, unknown>): OpmlImportFeedJob {
  if (
    typeof parsedPayload.taskId !== "string" ||
    typeof parsedPayload.userId !== "string" ||
    typeof parsedPayload.url !== "string"
  ) {
    throw new Error("Invalid opml.import.feed payload");
  }

  return {
    type: "opml.import.feed",
    payload: {
      taskId: parsedPayload.taskId,
      userId: parsedPayload.userId,
      url: parsedPayload.url,
      title: typeof parsedPayload.title === "string" ? parsedPayload.title : undefined,
      folderId:
        typeof parsedPayload.folderId === "string"
          ? parsedPayload.folderId
          : parsedPayload.folderId === null
            ? null
            : undefined,
    },
  };
}

export function parseJob(fields: Record<string, string>): Job {
  const parsedPayload = JSON.parse(fields.payload ?? "null") as Record<string, unknown> | null;
  if (!parsedPayload) {
    throw new Error(`Invalid ${fields.type ?? "unknown"} payload`);
  }

  switch (fields.type) {
    case "feed.refresh":
      return parseFeedRefreshJob(parsedPayload);
    case "opml.import":
      return parseOpmlImportJob(parsedPayload);
    case "opml.import.feed":
      return parseOpmlImportFeedJob(parsedPayload);
    default:
      throw new Error(`Unsupported job type: ${fields.type ?? "unknown"}`);
  }
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

type RedisTransaction = {
  xadd: (...args: unknown[]) => RedisTransaction;
  xack: (...args: unknown[]) => RedisTransaction;
  exec: () => Promise<unknown>;
};

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

function deadLetterFieldsFromRawInput(
  fields: string[],
  id: string,
  error: unknown,
): Record<string, string> {
  const base =
    fields.length % 2 === 0
      ? streamFieldsToRecord(fields)
      : {
          raw_fields: JSON.stringify(fields),
        };
  const errorMessage = error instanceof Error ? error.message : String(error);

  return {
    ...base,
    attempts: base.attempts ?? "0",
    error: errorMessage,
    failed_at: new Date().toISOString(),
    original_stream_id: id,
  };
}

async function xaddAndAck(
  redis: Redis,
  options: {
    destinationStream: string;
    destinationFields: Record<string, string>;
    destinationMaxLength: number;
    sourceStream: string;
    group: string;
    id: string;
  },
): Promise<void> {
  const tx = (redis as Redis & { multi: () => RedisTransaction }).multi();
  tx.xadd(
    options.destinationStream,
    "MAXLEN",
    "~",
    String(options.destinationMaxLength),
    "*",
    ...toRedisStreamFieldList(options.destinationFields),
  );
  tx.xack(options.sourceStream, options.group, options.id);
  await tx.exec();
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
  streamMaxLength?: number;
  processConcurrency?: number;
  deadLetterStreamKey?: string;
  signal?: AbortSignal;
  onJob: (message: JobMessage) => Promise<void>;
  onError?: (error: unknown, message: JobMessage | null) => Promise<void> | void;
};

type ResolvedConsumeJobsConfig = {
  consumer: string;
  onJob: (message: JobMessage) => Promise<void>;
  onError?: (error: unknown, message: JobMessage | null) => Promise<void> | void;
  signal?: AbortSignal;
  blockMs: number;
  count: number;
  maxAttempts: number;
  retryDelayMs: number;
  pendingMinIdleMs: number;
  streamMaxLength: number;
  processConcurrency: number;
  deadLetterStreamKey: string;
  group: string;
  streamKey: string;
};

type ProcessMessageOptions = {
  streamKey: string;
  group: string;
  deadLetterStreamKey: string;
  streamMaxLength: number;
  processConcurrency: number;
  maxAttempts: number;
  retryDelayMs: number;
  signal?: AbortSignal;
  onJob: (message: JobMessage) => Promise<void>;
  onError?: (error: unknown, message: JobMessage | null) => Promise<void> | void;
};

type ReadGroupMessagesResult =
  | { kind: "break" }
  | { kind: "continue" }
  | { kind: "messages"; messages: [string, string[]][] };

function isRedisConnectionClosedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Connection is closed");
}

function resolveConsumeJobsConfig(options: ConsumeJobsOptions): ResolvedConsumeJobsConfig {
  const queueOptions = normalizeQueueOptions({
    streamKey: options.streamKey,
    streamMaxLength: options.streamMaxLength,
    processConcurrency: options.processConcurrency,
  });

  return {
    consumer: options.consumer,
    onJob: options.onJob,
    onError: options.onError,
    signal: options.signal,
    blockMs: options.blockMs ?? 5_000,
    count: options.count ?? 1,
    maxAttempts: options.maxAttempts ?? 3,
    retryDelayMs: options.retryDelayMs ?? 0,
    pendingMinIdleMs: options.pendingMinIdleMs ?? 10_000,
    streamMaxLength: queueOptions.streamMaxLength,
    processConcurrency: queueOptions.processConcurrency,
    deadLetterStreamKey: options.deadLetterStreamKey ?? JOBS_DEAD_LETTER_STREAM_KEY,
    group: options.group ?? JOBS_CONSUMER_GROUP,
    streamKey: queueOptions.streamKey ?? JOBS_STREAM_KEY,
  };
}

async function retryOrDeadLetterJob(
  redis: Redis,
  options: {
    streamKey: string;
    deadLetterStreamKey: string;
    group: string;
    message: JobMessage;
    maxAttempts: number;
    retryDelayMs: number;
    streamMaxLength: number;
  },
): Promise<void> {
  if (options.message.attempts + 1 < options.maxAttempts) {
    await xaddAndAck(redis, {
      destinationStream: options.streamKey,
      destinationMaxLength: options.streamMaxLength,
      destinationFields: fieldsForJob(options.message.job, {
        attempts: options.message.attempts + 1,
        lastError: options.message.rawFields.last_error,
      }),
      sourceStream: options.streamKey,
      group: options.group,
      id: options.message.id,
    });
    if (options.retryDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.retryDelayMs));
    }
    return;
  }

  await xaddAndAck(redis, {
    destinationStream: options.deadLetterStreamKey,
    destinationMaxLength: options.streamMaxLength,
    destinationFields: {
      ...fieldsForJob(options.message.job, {
        attempts: options.message.attempts + 1,
        lastError: options.message.rawFields.last_error,
      }),
      failed_at: new Date().toISOString(),
      original_stream_id: options.message.id,
    },
    sourceStream: options.streamKey,
    group: options.group,
    id: options.message.id,
  });
}

async function claimPendingJobs(
  redis: Redis,
  options: {
    streamKey: string;
    group: string;
    consumer: string;
    minIdleMs: number;
    count: number;
  },
): Promise<[string, string[]][]> {
  const response = (await redis.call(
    "XAUTOCLAIM",
    options.streamKey,
    options.group,
    options.consumer,
    String(options.minIdleMs),
    "0-0",
    "COUNT",
    String(options.count),
  )) as [string, [string, string[]][]];

  return response[1] ?? [];
}

async function claimPendingMessagesSafe(
  redis: Redis,
  config: ResolvedConsumeJobsConfig,
): Promise<[string, string[]][]> {
  return claimPendingJobs(redis, {
    streamKey: config.streamKey,
    group: config.group,
    consumer: config.consumer,
    minIdleMs: config.pendingMinIdleMs,
    count: config.count,
  });
}

async function processMessage(
  redis: Redis,
  options: ProcessMessageOptions,
  id: string,
  fields: string[],
): Promise<void> {
  let message: JobMessage | null = null;

  try {
    message = parseJobMessageFields(id, streamFieldsToRecord(fields));
    await options.onJob(message);
    await redis.xack(options.streamKey, options.group, id);
  } catch (error) {
    await options.onError?.(error, message);

    if (message) {
      await retryOrDeadLetterJob(redis, {
        streamKey: options.streamKey,
        deadLetterStreamKey: options.deadLetterStreamKey,
        group: options.group,
        message,
        maxAttempts: options.maxAttempts,
        retryDelayMs: options.retryDelayMs,
        streamMaxLength: options.streamMaxLength,
      });
      return;
    }

    await xaddAndAck(redis, {
      destinationStream: options.deadLetterStreamKey,
      destinationMaxLength: options.streamMaxLength,
      destinationFields: deadLetterFieldsFromRawInput(fields, id, error),
      sourceStream: options.streamKey,
      group: options.group,
      id,
    });
  }
}

async function processJobMessages(
  redis: Redis,
  options: ProcessMessageOptions,
  messages: [string, string[]][],
): Promise<void> {
  const executing = new Set<Promise<void>>();

  for (const [id, fields] of messages) {
    if (options.signal?.aborted) {
      return;
    }

    const task = processMessage(redis, options, id, fields).finally(() => {
      executing.delete(task);
    });
    executing.add(task);

    if (executing.size >= options.processConcurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}

async function readNewGroupMessages(
  redis: Redis,
  config: ResolvedConsumeJobsConfig,
): Promise<ReadGroupMessagesResult> {
  try {
    const response = (await redis.xreadgroup(
      "GROUP",
      config.group,
      config.consumer,
      "COUNT",
      config.count,
      "BLOCK",
      config.blockMs,
      "STREAMS",
      config.streamKey,
      ">",
    )) as [[string, [string, string[]][]]] | null;

    if (config.signal?.aborted) {
      return { kind: "break" };
    }
    if (!response || !response[0]?.[1]?.length) {
      return { kind: "continue" };
    }

    return {
      kind: "messages",
      messages: response[0][1],
    };
  } catch (error) {
    if (config.signal?.aborted && isRedisConnectionClosedError(error)) {
      return { kind: "break" };
    }
    throw error;
  }
}

export async function consumeJobs(redis: Redis, options: ConsumeJobsOptions): Promise<void> {
  const config = resolveConsumeJobsConfig(options);
  await ensureConsumerGroup(redis, config.group, config.streamKey);

  const processOptions: ProcessMessageOptions = {
    streamKey: config.streamKey,
    group: config.group,
    deadLetterStreamKey: config.deadLetterStreamKey,
    streamMaxLength: config.streamMaxLength,
    processConcurrency: config.processConcurrency,
    maxAttempts: config.maxAttempts,
    retryDelayMs: config.retryDelayMs,
    signal: config.signal,
    onJob: config.onJob,
    onError: config.onError,
  };

  while (!config.signal?.aborted) {
    const pendingMessages = await claimPendingMessagesSafe(redis, config);
    if (pendingMessages.length > 0) {
      await processJobMessages(redis, processOptions, pendingMessages);
      continue;
    }

    const readResult = await readNewGroupMessages(redis, config);
    if (readResult.kind === "break") {
      break;
    }
    if (readResult.kind === "continue") {
      continue;
    }

    await processJobMessages(redis, processOptions, readResult.messages);
  }
}
