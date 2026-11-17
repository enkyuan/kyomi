import { describe, expect, test } from "bun:test";
import {
  FeedRefreshFailed,
  classifyJobFailure,
  isNonRetryableFeedRefreshFailure,
  toJobFailure,
} from "@app/jobs/classify";
import {
  DatabaseError,
  InternalError,
  NotFound,
  RateLimited,
  RedisError,
  Unavailable,
} from "@shared/effect/errors";

describe("isNonRetryableFeedRefreshFailure", () => {
  test("acks permanent fetch failures so the scheduler can own backoff", () => {
    expect(
      isNonRetryableFeedRefreshFailure({
        ok: false,
        itemCount: 0,
        error: "Feed fetch failed: HTTP 404",
        permanent: true,
      }),
    ).toBe(true);
  });

  test("keeps transient fetch failures retryable", () => {
    expect(
      isNonRetryableFeedRefreshFailure({
        ok: false,
        itemCount: 0,
        error: "Feed fetch failed: HTTP 503",
        permanent: false,
      }),
    ).toBe(false);
  });

  test("keeps unexpected refresh failures retryable when permanence is unknown", () => {
    expect(
      isNonRetryableFeedRefreshFailure({
        ok: false,
        itemCount: 0,
        error: "Unsupported feed format",
      }),
    ).toBe(false);
  });

  test("does not treat successful refreshes as non-retryable", () => {
    expect(isNonRetryableFeedRefreshFailure({ ok: true, itemCount: 3 })).toBe(false);
  });
});

describe("toJobFailure", () => {
  test("passes typed failures through unchanged", () => {
    const failure = new RedisError({ operation: "xadd", cause: new Error("down") });
    expect(toJobFailure(failure)).toBe(failure);
    const refresh = new FeedRefreshFailed({ message: "x", feedId: "f" });
    expect(toJobFailure(refresh)).toBe(refresh);
  });

  test("keeps the cause of anything else as an InternalError", () => {
    const cause = new Error("connection terminated");
    const failure = toJobFailure(cause);

    expect(failure).toBeInstanceOf(InternalError);
    expect(failure).toMatchObject({ message: "connection terminated", cause });
    expect(toJobFailure("boom")).toMatchObject({ _tag: "InternalError", message: "Job failed" });
  });
});

describe("classifyJobFailure", () => {
  test("a deterministic 4xx from a job is permanent and expected", () => {
    const failure = toJobFailure(
      new NotFound({ message: "Article not found", code: "ARTICLE_NOT_FOUND" }),
    );

    expect(classifyJobFailure(failure)).toEqual({
      severity: "expected",
      code: "ARTICLE_NOT_FOUND",
      retryable: false,
    });
  });

  test("timeouts, rate limits and server errors are retryable", () => {
    expect(classifyJobFailure(new RateLimited({ message: "slow down" })).retryable).toBe(true);
    expect(classifyJobFailure(new Unavailable({ message: "later" })).retryable).toBe(true);
    expect(classifyJobFailure(new InternalError({ message: "boom", code: "BOOM" }))).toEqual({
      severity: "platform",
      code: "BOOM",
      retryable: true,
    });
  });

  test("infrastructure failures are retryable platform failures", () => {
    const database = classifyJobFailure(new DatabaseError({ operation: "select", cause: 1 }));
    expect(database).toEqual({ severity: "platform", code: "INTERNAL_ERROR", retryable: true });
    expect(
      classifyJobFailure(new RedisError({ operation: "xadd", cause: 1, code: "NOGROUP" })),
    ).toMatchObject({ severity: "platform", retryable: true });
  });

  test("classifies by error class, never by what the message says", () => {
    // A message that reads like a permanent 404 must not make an internal error permanent.
    const misleading = new InternalError({ message: "Feed fetch failed: HTTP 404" });
    expect(classifyJobFailure(misleading)).toMatchObject({ severity: "platform", retryable: true });
  });

  test("a feed refresh failure carries its class and stays retryable", () => {
    expect(
      classifyJobFailure(
        new FeedRefreshFailed({ message: "HTTP 503", feedId: "f", failureClass: "http_5xx" }),
      ),
    ).toEqual({ severity: "expected", code: "http_5xx", retryable: true });
    expect(classifyJobFailure(new FeedRefreshFailed({ message: "weird", feedId: "f" }))).toEqual({
      severity: "platform",
      code: "unknown",
      retryable: true,
    });
  });
});
