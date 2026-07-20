import { afterEach, describe, expect, test } from "bun:test";
import {
  classifyFeedRefreshError,
  isNonRetryableFeedRefreshFailure,
} from "@app/jobs/refresh-errors";
import { runFeedRefresh } from "@kyomi/worker";

const originalFetch = globalThis.fetch;

function mockFetch(handler: () => Response | Promise<Response>): typeof fetch {
  return handler as unknown as typeof fetch;
}

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
            where: () => ({
              returning: () => Promise.resolve([{ generation: 0 }]),
            }),
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
    expect(
      classifyFeedRefreshError(
        new Error(
          'Feed fetch failed: ERR_TLS_CERT_ALTNAME_INVALID fetching "https://example.com/feed"',
        ),
      ),
    ).toEqual({
      severity: "feed",
      code: "certificate",
      retryable: false,
    });
    expect(
      classifyFeedRefreshError(
        new Error("Feed returned HTML (access_denied_html): no feed alternate found"),
      ),
    ).toEqual({
      severity: "feed",
      code: "access_denied_html",
      retryable: false,
    });
  });

  test("classifies platform errors separately", () => {
    expect(classifyFeedRefreshError(new Error("Redis connection closed")).severity).toBe(
      "platform",
    );
  });
});

describe("runFeedRefresh HTML responses", () => {
  test("marks TLS certificate fetch failures as permanent feed-owner failures", async () => {
    const fake = createFeedRefreshDb();
    const startedAt = Date.now();
    globalThis.fetch = mockFetch(() => {
      throw new Error(
        'ERR_TLS_CERT_ALTNAME_INVALID fetching "https://marycalotes.com/category/wedding/feed"',
      );
    });

    const result = await runFeedRefresh(fake.db as never, "feed-1", undefined, {
      enrichArticles: false,
    });

    expect(result.ok).toBe(false);
    expect(result.permanent).toBe(true);
    expect(result.error).toBe(
      'Feed fetch failed: ERR_TLS_CERT_ALTNAME_INVALID fetching "https://marycalotes.com/category/wedding/feed"',
    );
    expect(fake.updates.at(-1)?.refreshStatus).toBe("failed");
    expect(fake.updates.at(-1)?.lastRefreshError).toBe(
      'ERR_TLS_CERT_ALTNAME_INVALID fetching "https://marycalotes.com/category/wedding/feed"',
    );
    expect((fake.updates.at(-1)?.nextRefreshAt as Date).getTime()).toBeGreaterThanOrEqual(
      startedAt + 23 * 60 * 60 * 1000,
    );
  });

  test("marks HTML without an alternate as a permanent feed-owner failure", async () => {
    const fake = createFeedRefreshDb();
    globalThis.fetch = mockFetch(
      () =>
        new Response(
          "<!doctype html><html><head><title>Access denied</title></head><body>Blocked</body></html>",
          {
            status: 200,
            headers: { "content-type": "text/html" },
          },
        ),
    );

    const result = await runFeedRefresh(fake.db as never, "feed-1", undefined, {
      enrichArticles: false,
    });

    expect(result.ok).toBe(false);
    expect(result.permanent).toBe(true);
    expect(result.failureClass).toBe("access_denied_html");
    expect(result.error).toBe("Feed returned HTML (access_denied_html): no feed alternate found");
    expect(fake.updates.at(-1)?.refreshStatus).toBe("failed");
    expect(fake.updates.at(-1)?.lastRefreshError).toBe(
      "Feed returned HTML (access_denied_html): no feed alternate found",
    );
  });
});
