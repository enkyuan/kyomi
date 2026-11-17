import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import {
  BadGateway,
  BadRequest,
  DatabaseError,
  GatewayTimeout,
  InternalError,
  NotFound,
  RateLimited,
} from "@shared/effect/errors";
import {
  classifyOpmlItemError,
  computeOpmlRetryDelayMs,
  opmlRetryJitter,
} from "@modules/opml/retry";

describe("classifyOpmlItemError", () => {
  test("classifies invalid and forbidden URLs as permanent", () => {
    for (const code of ["INVALID_FEED_URL", "FEED_URL_FORBIDDEN"]) {
      expect(classifyOpmlItemError(new BadRequest({ message: "bad", code }))).toEqual({
        retryable: false,
        code,
        message: "bad",
      });
    }
  });

  test("classifies OPML-specific invalid-url and parse-failure codes as permanent", () => {
    expect(
      classifyOpmlItemError(new BadRequest({ message: "bad", code: "OPML_FEED_URL_INVALID" })),
    ).toEqual({ retryable: false, code: "OPML_FEED_URL_INVALID", message: "bad" });
    expect(
      classifyOpmlItemError(new BadGateway({ message: "bad", code: "FEED_PARSE_FAILED" })),
    ).toEqual({ retryable: false, code: "FEED_PARSE_FAILED", message: "bad" });
  });

  test("classifies timeout, 429 and 5xx errors as retryable and keeps their code", () => {
    expect(
      classifyOpmlItemError(new GatewayTimeout({ message: "timeout", code: "FEED_FETCH_FAILED" })),
    ).toEqual({ retryable: true, code: "FEED_FETCH_FAILED", message: "timeout" });
    expect(classifyOpmlItemError(new RateLimited({ message: "slow down" }))).toEqual({
      retryable: true,
      code: "RATE_LIMITED",
      message: "slow down",
    });
    expect(
      classifyOpmlItemError(new InternalError({ message: "boom", code: "SERVER_ERROR" })).retryable,
    ).toBe(true);
  });

  test("classifies other 4xx errors as permanent", () => {
    expect(
      classifyOpmlItemError(new NotFound({ message: "not found", code: "FEED_NOT_FOUND" })),
    ).toEqual({ retryable: false, code: "FEED_NOT_FOUND", message: "not found" });
  });

  test("retries infrastructure failures under the generic import code", () => {
    expect(
      classifyOpmlItemError(new DatabaseError({ operation: "opml.item.complete", cause: "down" })),
    ).toEqual({
      retryable: true,
      code: "OPML_FEED_IMPORT_FAILED",
      message: "Database operation failed: opml.item.complete",
    });
  });
});

describe("computeOpmlRetryDelayMs", () => {
  test("uses capped exponential backoff with bounded jitter", () => {
    expect(computeOpmlRetryDelayMs(1, 0)).toBe(5_000);
    expect(computeOpmlRetryDelayMs(5, 0)).toBe(80_000);
    expect(computeOpmlRetryDelayMs(20, 0)).toBe(900_000);
  });

  test("clamps jitter to +/-20% instead of applying an unbounded multiplier", () => {
    expect(computeOpmlRetryDelayMs(1, 1)).toBe(6_000);
    expect(computeOpmlRetryDelayMs(1, -1)).toBe(4_000);
  });

  test("treats attempt 0 or negative the same as attempt 1", () => {
    expect(computeOpmlRetryDelayMs(0, 0)).toBe(5_000);
    expect(computeOpmlRetryDelayMs(-3, 0)).toBe(5_000);
  });
});

describe("opmlRetryJitter", () => {
  test("stays within +/-20%", () => {
    for (let run = 0; run < 200; run += 1) {
      const jitter = Effect.runSync(opmlRetryJitter);
      expect(jitter).toBeGreaterThanOrEqual(-0.2);
      expect(jitter).toBeLessThan(0.2);
    }
  });
});
