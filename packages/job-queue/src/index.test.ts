import { describe, expect, mock, test } from "bun:test";
import {
  JOBS_DEAD_LETTER_STREAM_KEY,
  JOBS_STREAM_KEY,
  consumeJobs,
  fieldsForJob,
  parseJob,
  parseJobMessageFields,
  toRedisStreamFieldList,
} from "./index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MockCall = { cmd: string; args: unknown[] };

function makeMockRedis(overrides?: Partial<Record<string, (...args: unknown[]) => unknown>>) {
  const calls: MockCall[] = [];

  const handler = {
    get(_: object, cmd: string) {
      if (cmd === "calls") return calls;
      return overrides?.[cmd] ?? ((...args: unknown[]) => {
        calls.push({ cmd, args });
        return Promise.resolve("OK");
      });
    },
  };

  return new Proxy({} as Record<string, unknown>, handler) as {
    calls: MockCall[];
    xadd: (...args: unknown[]) => Promise<string>;
    xack: (...args: unknown[]) => Promise<number>;
    xreadgroup: (...args: unknown[]) => Promise<unknown>;
    call: (...args: unknown[]) => Promise<unknown>;
    xgroup: (...args: unknown[]) => Promise<string>;
  };
}

const baseJob = {
  type: "feed.refresh" as const,
  payload: { feedId: "feed_1", userId: "user_1" },
};

// ---------------------------------------------------------------------------
// Existing tests
// ---------------------------------------------------------------------------

describe("job-queue", () => {
  test("round-trips a feed refresh job through flat fields", () => {
    const fields = fieldsForJob(baseJob);
    expect(toRedisStreamFieldList(fields)).toEqual([
      "type",
      "feed.refresh",
      "payload",
      JSON.stringify(baseJob.payload),
    ]);
    expect(parseJob(fields)).toEqual(baseJob);
    expect(parseJobMessageFields("1-0", fields)).toEqual({
      id: "1-0",
      job: baseJob,
      attempts: 0,
      rawFields: fields,
    });
  });

  test("rejects unknown job types", () => {
    expect(() => parseJob({ type: "nope", payload: "{}" })).toThrow("Unsupported job type");
  });
});

// ---------------------------------------------------------------------------
// processMessage / retry / dead-letter tests
// We test the internal retry/dead-letter logic by driving consumeJobs with a
// controlled mock Redis that delivers exactly one message per run then aborts.
// ---------------------------------------------------------------------------

function validFields(): string[] {
  return ["type", "feed.refresh", "payload", JSON.stringify(baseJob.payload), "attempts", "0"];
}

function invalidFields(): string[] {
  return ["type", "unknown-type", "payload", "{}"];
}

describe("retry and dead-letter", () => {
  test("successful job is XACK-ed once and not retried", async () => {
    const controller = new AbortController();
    const redis = makeMockRedis({
      xgroup: () => Promise.resolve("OK"),
      call: () => Promise.resolve(["0-0", []]),
      xreadgroup: () => {
        controller.abort();
        return Promise.resolve([[JOBS_STREAM_KEY, [["1-1", validFields()]]]]);
      },
      xack: mock(() => {
        return Promise.resolve(1);
      }),
      xadd: mock(() => Promise.resolve("2-0")),
    });

    await consumeJobs(redis as never, {
      consumer: "w1",
      signal: controller.signal,
      onJob: async () => {},
    });

    const xackCalls = (redis.xack as ReturnType<typeof mock>).mock.calls;
    expect(xackCalls.length).toBe(1);
    expect(xackCalls[0]).toContain("1-1");

    // No retry re-enqueue
    const xaddCalls = (redis.xadd as ReturnType<typeof mock>).mock.calls;
    expect(xaddCalls.length).toBe(0);
  });

  test("failed job below maxAttempts is re-enqueued with incremented attempts", async () => {
    const controller = new AbortController();
    const redis = makeMockRedis({
      xgroup: () => Promise.resolve("OK"),
      call: () => Promise.resolve(["0-0", []]),
      xreadgroup: () => {
        controller.abort();
        return Promise.resolve([[JOBS_STREAM_KEY, [["1-2", validFields()]]]]);
      },
      xack: mock(() => Promise.resolve(1)),
      xadd: mock(() => Promise.resolve("2-0")),
    });

    await consumeJobs(redis as never, {
      consumer: "w1",
      signal: controller.signal,
      maxAttempts: 3,
      onJob: async () => {
        throw new Error("job handler error");
      },
    });

    const xaddCalls = (redis.xadd as ReturnType<typeof mock>).mock.calls;
    // Should re-enqueue to the main stream
    expect(xaddCalls.length).toBe(1);
    const xaddArgs = xaddCalls[0] as string[];
    expect(xaddArgs[0]).toBe(JOBS_STREAM_KEY);
    // Should include attempts=1
    const attemptsIdx = xaddArgs.indexOf("attempts");
    expect(attemptsIdx).toBeGreaterThan(-1);
    expect(xaddArgs[attemptsIdx + 1]).toBe("1");
  });

  test("failed job at maxAttempts is dead-lettered", async () => {
    const controller = new AbortController();
    // Simulate a message already at attempt 3 (maxAttempts=3)
    const maxedFields = [
      "type",
      "feed.refresh",
      "payload",
      JSON.stringify(baseJob.payload),
      "attempts",
      "3",
    ];

    const redis = makeMockRedis({
      xgroup: () => Promise.resolve("OK"),
      call: () => Promise.resolve(["0-0", []]),
      xreadgroup: () => {
        controller.abort();
        return Promise.resolve([[JOBS_STREAM_KEY, [["1-3", maxedFields]]]]);
      },
      xack: mock(() => Promise.resolve(1)),
      xadd: mock(() => Promise.resolve("2-0")),
    });

    await consumeJobs(redis as never, {
      consumer: "w1",
      signal: controller.signal,
      maxAttempts: 3,
      onJob: async () => {
        throw new Error("permanent failure");
      },
    });

    const xaddCalls = (redis.xadd as ReturnType<typeof mock>).mock.calls;
    // Should write to dead-letter stream
    expect(xaddCalls.length).toBe(1);
    const xaddArgs = xaddCalls[0] as string[];
    expect(xaddArgs[0]).toBe(JOBS_DEAD_LETTER_STREAM_KEY);
    // Should include original_stream_id
    const origIdx = xaddArgs.indexOf("original_stream_id");
    expect(origIdx).toBeGreaterThan(-1);
    expect(xaddArgs[origIdx + 1]).toBe("1-3");
  });

  test("poison message (parse failure) is dead-lettered and XACK-ed", async () => {
    const controller = new AbortController();

    const redis = makeMockRedis({
      xgroup: () => Promise.resolve("OK"),
      call: () => Promise.resolve(["0-0", []]),
      xreadgroup: () => {
        controller.abort();
        return Promise.resolve([[JOBS_STREAM_KEY, [["1-4", invalidFields()]]]]);
      },
      xack: mock(() => Promise.resolve(1)),
      xadd: mock(() => Promise.resolve("2-0")),
    });

    const errors: unknown[] = [];
    await consumeJobs(redis as never, {
      consumer: "w1",
      signal: controller.signal,
      onJob: async () => {},
      onError: (err) => {
        errors.push(err);
      },
    });

    // onError should have been called with the parse error
    expect(errors.length).toBe(1);

    // Dead-lettered
    const xaddCalls = (redis.xadd as ReturnType<typeof mock>).mock.calls;
    expect(xaddCalls.length).toBe(1);
    expect((xaddCalls[0] as string[])[0]).toBe(JOBS_DEAD_LETTER_STREAM_KEY);

    // XACK-ed so it's not stuck in the PEL
    const xackCalls = (redis.xack as ReturnType<typeof mock>).mock.calls;
    expect(xackCalls.length).toBe(1);
    expect(xackCalls[0]).toContain("1-4");
  });

  test("retryDelayMs resolves promptly when signal is aborted", async () => {
    const controller = new AbortController();

    const redis = makeMockRedis({
      xgroup: () => Promise.resolve("OK"),
      call: () => Promise.resolve(["0-0", []]),
      xreadgroup: () => {
        return Promise.resolve([[JOBS_STREAM_KEY, [["1-5", validFields()]]]]);
      },
      xack: mock(() => {
        // After first xack-on-retry, stop the loop
        controller.abort();
        return Promise.resolve(1);
      }),
      xadd: mock(() => Promise.resolve("2-0")),
    });

    const start = Date.now();
    await consumeJobs(redis as never, {
      consumer: "w1",
      signal: controller.signal,
      maxAttempts: 3,
      retryDelayMs: 30_000, // very long — should be bypassed by abort signal
      onJob: async () => {
        // Abort immediately so the delay races with the abort
        controller.abort();
        throw new Error("fail");
      },
    });

    const elapsed = Date.now() - start;
    // Should complete well under the full 30-second delay
    expect(elapsed).toBeLessThan(5_000);
  });

  test("XAUTOCLAIM pending messages are processed correctly", async () => {
    const controller = new AbortController();

    const redis = makeMockRedis({
      xgroup: () => Promise.resolve("OK"),
      // First call returns a pending message; subsequent calls return empty
      call: mock(
        (() => {
          let callCount = 0;
          return () => {
            callCount += 1;
            if (callCount === 1) {
              return Promise.resolve(["0-0", [["2-0", validFields()]]]);
            }
            controller.abort();
            return Promise.resolve(["0-0", []]);
          };
        })(),
      ),
      xreadgroup: () => Promise.resolve(null),
      xack: mock(() => Promise.resolve(1)),
      xadd: mock(() => Promise.resolve("3-0")),
    });

    await consumeJobs(redis as never, {
      consumer: "w1",
      signal: controller.signal,
      onJob: async () => {},
    });

    const xackCalls = (redis.xack as ReturnType<typeof mock>).mock.calls;
    expect(xackCalls.length).toBe(1);
    expect(xackCalls[0]).toContain("2-0");
  });
});
