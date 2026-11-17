import type Redis from "ioredis";
import { env } from "@config/env";
import type { Job, QueueOptions } from "@kyomi/ingest";
import { xaddJob } from "./service";

/**
 * XADD a typed job. Returns the Redis stream id.
 *
 * Promise entrypoint for modules that have not moved to Effect yet; Effect code publishes through
 * the `JobQueue` service. Delete this file with the last module that still calls it.
 */
export function publishJob(redis: Redis, job: Job, options: QueueOptions = {}): Promise<string> {
  return xaddJob(redis, job, options, env.JOB_STREAM_MAX_LENGTH);
}
