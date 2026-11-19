import { describe, expect, test } from "bun:test";
import { DEFAULT_RETRY_BACKOFF, retryCeilingMs, retryDelayMs } from "@adapters/queue/backoff";

describe("retryCeilingMs", () => {
  test("starts at 5 seconds and doubles each retry", () => {
    expect([1, 2, 3, 4, 5].map((retry) => retryCeilingMs(retry))).toEqual([
      5_000, 10_000, 20_000, 40_000, 80_000,
    ]);
  });

  test("never passes 5 minutes, however many retries there have been", () => {
    expect(retryCeilingMs(7)).toBe(300_000);
    expect(retryCeilingMs(50)).toBe(300_000);
    expect(retryCeilingMs(10_000)).toBe(300_000);
  });

  test("treats a retry number below 1 as the first", () => {
    expect(retryCeilingMs(0)).toBe(5_000);
    expect(retryCeilingMs(-3)).toBe(5_000);
  });

  test("follows the backoff it is given", () => {
    expect(retryCeilingMs(3, { baseMs: 100, maxMs: 1_000 })).toBe(400);
    expect(retryCeilingMs(9, { baseMs: 100, maxMs: 1_000 })).toBe(1_000);
  });
});

describe("retryDelayMs", () => {
  test("is spread over the whole window, from no wait to just under the ceiling", () => {
    expect(retryDelayMs(2, 0)).toBe(0);
    expect(retryDelayMs(2, 0.5)).toBe(5_000);
    expect(retryDelayMs(2, 0.999_999)).toBeLessThan(10_000);
    expect(retryDelayMs(2, 0.999_999)).toBeGreaterThan(9_990);
  });

  test("is a whole number of milliseconds", () => {
    expect(Number.isInteger(retryDelayMs(1, 0.123_456_789))).toBe(true);
  });

  test("clamps a fraction outside [0, 1) instead of waiting longer than the ceiling", () => {
    expect(retryDelayMs(1, -1)).toBe(0);
    expect(retryDelayMs(1, 1)).toBeLessThan(5_000);
    expect(retryDelayMs(1, 7)).toBeLessThan(5_000);
  });

  test("never exceeds the ceiling for any fraction", () => {
    for (let retry = 1; retry <= 12; retry += 1) {
      for (const fraction of [0, 0.25, 0.5, 0.75, 0.999_999]) {
        expect(retryDelayMs(retry, fraction)).toBeLessThan(retryCeilingMs(retry));
      }
    }
  });

  test("uses the default backoff unless given another", () => {
    expect(DEFAULT_RETRY_BACKOFF).toEqual({ baseMs: 5_000, maxMs: 300_000 });
    expect(retryDelayMs(1, 0.5, { baseMs: 1_000, maxMs: 1_000 })).toBe(500);
  });
});
