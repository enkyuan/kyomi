import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const schedulerSourcePath = join(
  import.meta.dir,
  "../../../../../apps/api/src/app/jobs/refresh-scheduler.ts",
);

describe("feed refresh scheduler", () => {
  test("claim SQL uses row locks, skip locked, stale claim recovery, and queued state", () => {
    const source = readFileSync(schedulerSourcePath, "utf8");

    expect(source).toContain("FOR UPDATE SKIP LOCKED");
    expect(source).toContain("refresh_status = 'queued'");
    expect(source).toContain("staleQueuedBefore");
    expect(source).toContain("releaseUnpublishedFeedRefreshClaims");
  });

  test("normalizes scheduler limits", async () => {
    process.env.SKIP_ENV_VALIDATION = "true";
    process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/kyomi";
    process.env.REDIS_URL ??= "redis://localhost:6379";
    process.env.WEB_ORIGIN ??= "http://localhost:3000";
    process.env.BETTER_AUTH_SECRET ??= "test-secret";
    const { normalizeSchedulerOptions } = await import("@app/jobs/refresh-scheduler");

    expect(normalizeSchedulerOptions({}).subscribedLimit).toBe(50);
    expect(normalizeSchedulerOptions({ globalLimit: 10_000 }).globalLimit).toBe(1_000);
    expect(normalizeSchedulerOptions({ maxQueuedRefreshJobs: 0 }).maxQueuedRefreshJobs).toBe(1);
    expect(normalizeSchedulerOptions({ queuedLeaseMs: 1 }).queuedLeaseMs).toBe(60_000);
  });
});
