import type IORedis from "ioredis";
import { Context, Effect, Layer } from "effect";
import {
  fieldsForJob,
  getStreamKeyForJobType,
  normalizeQueueOptions,
  toRedisStreamFieldList,
  type Job,
  type QueueOptions,
} from "@kyomi/ingest";
import { Redis } from "@adapters/redis/service";
import { AppConfig } from "@config/env/service";
import type { RedisError } from "@shared/effect/errors";

/** XADD a typed job to its stream. Resolves to the Redis stream id. */
export async function xaddJob(
  redis: IORedis,
  job: Job,
  options: QueueOptions,
  defaultStreamMaxLength: number,
): Promise<string> {
  const queueOptions = normalizeQueueOptions({
    ...options,
    streamMaxLength: options.streamMaxLength ?? defaultStreamMaxLength,
  });
  const streamKey = queueOptions.streamKey ?? getStreamKeyForJobType(job.type);
  const id = await redis.xadd(
    streamKey,
    "MAXLEN",
    "~",
    queueOptions.streamMaxLength,
    "*",
    ...toRedisStreamFieldList(fieldsForJob(job)),
  );
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Redis XADD did not return a stream id");
  }
  return id;
}

export type JobQueueShape = {
  /** Publish a job to the stream for its type. Resolves to the Redis stream id. */
  readonly publish: (job: Job, options?: QueueOptions) => Effect.Effect<string, RedisError>;
};

/** The job queue's producer side, over the `Redis` service and `JOB_STREAM_MAX_LENGTH`. */
export class JobQueue extends Context.Service<JobQueue, JobQueueShape>()("kyomi/JobQueue") {
  static readonly layer = Layer.effect(
    JobQueue,
    Effect.gen(function* () {
      const config = yield* AppConfig;
      const redis = yield* Redis;
      return JobQueue.of({
        publish: (job, options = {}) =>
          redis.use("xadd", (client) =>
            xaddJob(client, job, options, config.JOB_STREAM_MAX_LENGTH),
          ),
      });
    }),
  );
}
