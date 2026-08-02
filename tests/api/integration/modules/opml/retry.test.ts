import { describe, expect, test } from "bun:test";
import { AppError } from "@shared/errors/app";
import { classifyOpmlItemError, computeOpmlRetryDelayMs } from "@modules/opml/retry";

describe("classifyOpmlItemError", () => {
  test("classifies invalid and forbidden URLs as permanent", () => {
    for (const code of ["INVALID_FEED_URL", "FEED_URL_FORBIDDEN"]) {
      expect(classifyOpmlItemError(new AppError("bad", { status: 400, code }))).toEqual({
        retryable: false,
        code,
      });
    }
  });

  test("classifies OPML-specific invalid-url and parse-failure codes as permanent", () => {
    expect(
      classifyOpmlItemError(new AppError("bad", { status: 400, code: "OPML_FEED_URL_INVALID" })),
    ).toEqual({ retryable: false, code: "OPML_FEED_URL_INVALID" });
    expect(
      classifyOpmlItemError(new AppError("bad", { status: 502, code: "FEED_PARSE_FAILED" })),
    ).toEqual({ retryable: false, code: "FEED_PARSE_FAILED" });
  });

  test("classifies timeout, 429, 5xx, database, and unknown errors as retryable", () => {
    expect(
      classifyOpmlItemError(new AppError("timeout", { status: 504, code: "FEED_FETCH_FAILED" }))
        .retryable,
    ).toBe(true);
    expect(
      classifyOpmlItemError(new AppError("rate limited", { status: 429, code: "RATE_LIMITED" }))
        .retryable,
    ).toBe(true);
    expect(
      classifyOpmlItemError(new AppError("boom", { status: 500, code: "SERVER_ERROR" })).retryable,
    ).toBe(true);
    expect(classifyOpmlItemError(new Error("connection reset")).retryable).toBe(true);
    expect(classifyOpmlItemError("not an error object").retryable).toBe(true);
  });

  test("classifies other 4xx AppErrors as permanent", () => {
    expect(
      classifyOpmlItemError(new AppError("not found", { status: 404, code: "FEED_NOT_FOUND" })),
    ).toEqual({ retryable: false, code: "FEED_NOT_FOUND" });
  });

  test("falls back to a generic retryable code for a non-AppError", () => {
    expect(classifyOpmlItemError(new Error("connection reset"))).toEqual({
      retryable: true,
      code: "OPML_FEED_IMPORT_FAILED",
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
