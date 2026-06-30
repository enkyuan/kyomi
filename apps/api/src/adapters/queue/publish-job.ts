import type Redis from "ioredis";
import { fieldsForJob, JOBS_STREAM_KEY, toRedisStreamFieldList, type Job } from "@kyomi/worker";

/** XADD a typed job. Returns Redis stream ID. */
export async function publishJob(redis: Redis, job: Job): Promise<string> {
  const flat = fieldsForJob(job);
  const id = await redis.xadd(JOBS_STREAM_KEY, "*", ...toRedisStreamFieldList(flat));
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Redis XADD did not return a stream id");
  }
  return id;
}
