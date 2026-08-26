import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const root = join(import.meta.dir, "../../../../..");

describe("process roles", () => {
  test("worker boot does not start the scheduler", () => {
    const workerBoot = readFileSync(join(root, "apps/api/src/app/boot/worker.ts"), "utf8");
    expect(workerBoot).not.toContain("runFeedRefreshSchedulerLoop");
    expect(workerBoot).not.toContain("runImportDispatcherLoop");
  });

  test("scheduler boot runs the feed refresh scheduler and the import dispatcher concurrently", () => {
    const schedulerBoot = readFileSync(join(root, "apps/api/src/app/boot/scheduler.ts"), "utf8");
    expect(schedulerBoot).toContain("runFeedRefreshSchedulerLoop");
    expect(schedulerBoot).toContain("runImportDispatcherLoop");
    expect(schedulerBoot).toContain("Promise.all");
    expect(schedulerBoot).toContain("controller.signal");
    expect(schedulerBoot).not.toContain("runWorkerLoop");
  });

  test("compose defines separate worker and scheduler services", () => {
    const compose = readFileSync(join(root, "docker/docker-compose.yml"), "utf8");
    expect(compose).toContain("worker:");
    expect(compose).toContain("scheduler:");
  });
});
