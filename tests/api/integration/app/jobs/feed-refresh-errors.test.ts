import { afterEach, describe, expect, test } from "bun:test";
import {
  classifyFeedRefreshError,
  isNonRetryableFeedRefreshFailure,
} from "@app/jobs/feed-refresh-errors";
import { runFeedRefresh } from "@kyomi/worker";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function createFeedRefreshDb() {
  const updates: Array<Record<string, unknown>> = [];
  return {
    updates,
    db: {
      update: () => ({
        set: (patch: Record<string, unknown>) => {
          updates.push(patch);
          return {
            where: () => Promise.resolve(),
          };
        },
      }),
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([
                {
                  id: "feed-1",
                  url: "https://engineering.fb.com/feed/",
                  link: null,
                  faviconUrl: null,
                  faviconSource: null,
                  etag: null,
                  lastModified: null,
                  lastRefreshSucceededAt: null,
                  lastRefreshFailedAt: null,
                },
              ]),
          }),
        }),
      }),
    },
  };
}

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

describe("runFeedRefresh HTML responses", () => {
  test("marks a feed failed when a refresh returns an HTML document", async () => {
    const fake = createFeedRefreshDb();
    globalThis.fetch = async () =>
      new Response(
        "<!doctype html><html><head><title>Access denied</title></head><body>Blocked</body></html>",
        {
          status: 200,
          headers: { "content-type": "text/html" },
        },
      );

    const result = await runFeedRefresh(fake.db as never, "feed-1", undefined, {
      enrichArticles: false,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Unsupported feed format: received HTML document");
    expect(fake.updates.at(-1)?.refreshStatus).toBe("failed");
    expect(fake.updates.at(-1)?.lastRefreshError).toBe(
      "Unsupported feed format: received HTML document",
    );
  });
});
