import { describe, expect, test } from "bun:test";
import { INTERRUPTED_JOB_SETTLE_MS, shutdownWindows } from "@app/jobs/shutdown";

describe("shutdownWindows", () => {
  test("splits the default 30s budget into a 23s drain, a 2s settle and a 5s reserve", () => {
    expect(shutdownWindows(30_000)).toEqual({ drainMs: 23_000, settleMs: 2_000 });
  });

  test.each([8_000, 15_000, 30_000, 120_000, 300_000])(
    "never spends more than a %ims budget",
    (budgetMs) => {
      const { drainMs, settleMs } = shutdownWindows(budgetMs);

      // The reserve left over is what the process needs to close its clients and exit.
      expect(budgetMs - drainMs - settleMs).toBeGreaterThanOrEqual(5_000);
    },
  );

  test("keeps a floor on the drain for the smallest budget", () => {
    expect(shutdownWindows(5_000).drainMs).toBe(1_000);
    expect(shutdownWindows(5_000).settleMs).toBe(INTERRUPTED_JOB_SETTLE_MS);
  });
});
