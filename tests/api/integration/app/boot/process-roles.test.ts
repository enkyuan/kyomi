import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const root = join(import.meta.dir, "../../../../..");

describe("process roles", () => {
  test("worker boot does not start the scheduler", () => {
    const workerBoot = readFileSync(join(root, "apps/api/src/app/boot/worker.ts"), "utf8");
    expect(workerBoot).toContain("WorkerLive");
    expect(workerBoot).not.toContain("feedRefreshSchedulerLoop");
    expect(workerBoot).not.toContain("importDispatcherLoop");
  });

  test("scheduler boot runs the feed refresh scheduler and the import dispatcher concurrently", () => {
    const schedulerBoot = readFileSync(join(root, "apps/api/src/app/boot/scheduler.ts"), "utf8");
    expect(schedulerBoot).toContain("feedRefreshSchedulerLoop");
    expect(schedulerBoot).toContain("importDispatcherLoop");
    expect(schedulerBoot).toContain("Effect.all");
    expect(schedulerBoot).not.toContain("WorkerLive");
  });

  test("every process entrypoint hands shutdown to runMain, not to signal handlers of its own", () => {
    for (const entry of ["server", "worker", "scheduler", "dev"]) {
      const source = readFileSync(join(root, `apps/api/src/app/boot/${entry}.ts`), "utf8");
      expect(source).toContain("runMain(");
      expect(source).not.toContain("process.on(");
      expect(source).not.toContain("AbortController");
      expect(source).not.toContain("shutdownAdapters");
    }
  });

  test("compose defines separate worker and scheduler services", () => {
    const compose = readFileSync(join(root, "docker/docker-compose.yml"), "utf8");
    expect(compose).toContain("worker:");
    expect(compose).toContain("scheduler:");
  });
});
