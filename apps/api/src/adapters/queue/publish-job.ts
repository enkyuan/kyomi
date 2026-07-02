import type Redis from "ioredis";
import { env } from "@config/env";
import {
  fieldsForJob,
  getStreamKeyForJobType,
  normalizeQueueOptions,
  toRedisStreamFieldList,
  type Job,
  type QueueOptions,
} from "@kyomi/worker";

/** XADD a typed job. Returns Redis stream ID. */
export async function publishJob(
  redis: Redis,
  job: Job,
  options: QueueOptions = {},
): Promise<string> {
  const queueOptions = normalizeQueueOptions({
    ...options,
    streamMaxLength: options.streamMaxLength ?? env.JOB_STREAM_MAX_LENGTH,
  });
  const streamKey = queueOptions.streamKey ?? getStreamKeyForJobType(job.type);
  const flat = fieldsForJob(job);
  const id = await redis.xadd(
    streamKey,
    "MAXLEN",
    "~",
    queueOptions.streamMaxLength,
    "*",
    ...toRedisStreamFieldList(flat),
  );
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Redis XADD did not return a stream id");
  }
  return id;
}
