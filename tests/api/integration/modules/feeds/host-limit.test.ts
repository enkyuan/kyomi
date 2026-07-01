import { describe, expect, test } from "bun:test";
import { createHostRateLimiter, createMemoryHostRateLimitStore } from "@kyomi/worker/ingestion";

describe("host rate limiter", () => {
  test("serializes same-host work across limiter instances sharing one store", async () => {
    const store = createMemoryHostRateLimitStore();
    const limiterA = createHostRateLimiter({ store, leaseMs: 1_000, retryDelayMs: 10 });
    const limiterB = createHostRateLimiter({ store, leaseMs: 1_000, retryDelayMs: 10 });
    const events: string[] = [];

    await Promise.all([
      limiterA.run("https://example.com/a.xml", async () => {
        events.push("a:start");
        await new Promise((resolve) => setTimeout(resolve, 20));
        events.push("a:end");
      }),
      limiterB.run("https://example.com/b.xml", async () => {
        events.push("b:start");
        events.push("b:end");
      }),
    ]);

    expect(events).toEqual(["a:start", "a:end", "b:start", "b:end"]);
  });
});
