import { describe, expect, test } from "bun:test";
import {
  classifyFeedRefreshError,
  isNonRetryableFeedRefreshFailure,
} from "@app/jobs/feed-refresh-errors";

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
    expect(
      isNonRetryableFeedRefreshFailure({
        ok: true,
        itemCount: 3,
      }),
    ).toBe(false);
  });
});

describe("classifyFeedRefreshError", () => {
  test("classifies known feed-owner failures", () => {
    expect(classifyFeedRefreshError(new Error("Feed fetch failed: HTTP 404")).severity).toBe(
      "feed",
    );
    expect(
      classifyFeedRefreshError(new Error("Entity expansion limit exceeded: 1003 > 1000")).severity,
    ).toBe("feed");
    expect(
      classifyFeedRefreshError(
        new Error("Feed fetch failed: unknown certificate verification error"),
      ).severity,
    ).toBe("feed");
  });

  test("classifies platform errors separately", () => {
    expect(classifyFeedRefreshError(new Error("Redis connection closed")).severity).toBe(
      "platform",
    );
  });
});
