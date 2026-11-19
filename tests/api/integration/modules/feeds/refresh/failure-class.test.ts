import { afterEach, describe, expect, test } from "bun:test";
import { runFeedRefresh } from "@kyomi/ingest";

/**
 * Exercises the framework-free refresh service in `@kyomi/ingest`, which fetches through the
 * global `fetch` by design, so these tests patch it. The job classifier tests live with
 * `app/jobs/classify.test.ts` and need no patching.
 */
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

describe("runFeedRefresh failure results", () => {
  test("marks TLS certificate fetch failures as permanent feed-owner failures", async () => {
    const fake = createFeedRefreshDb();
    const startedAt = Date.now();
    globalThis.fetch = mockFetch(() => {
      throw new Error(
        'ERR_TLS_CERT_ALTNAME_INVALID fetching "https://marycalotes.com/category/wedding/feed"',
      );
    });

    const result = await runFeedRefresh(fake.db as never, "feed-1");

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

    const result = await runFeedRefresh(fake.db as never, "feed-1");

    expect(result.ok).toBe(false);
    expect(result.permanent).toBe(true);
    expect(result.failureClass).toBe("access_denied_html");
    expect(result.error).toBe("Feed returned HTML (access_denied_html): no feed alternate found");
    expect(fake.updates.at(-1)?.refreshStatus).toBe("failed");
    expect(fake.updates.at(-1)?.lastRefreshError).toBe(
      "Feed returned HTML (access_denied_html): no feed alternate found",
    );
  });

  test("reports a missing page as http_404 and keeps it permanent", async () => {
    const fake = createFeedRefreshDb();
    globalThis.fetch = mockFetch(() => new Response("gone", { status: 404 }));

    const result = await runFeedRefresh(fake.db as never, "feed-1");

    expect(result).toMatchObject({ ok: false, failureClass: "http_404", permanent: true });
  });

  test("reports other client errors as http_4xx and rate limiting as retryable", async () => {
    const forbidden = createFeedRefreshDb();
    globalThis.fetch = mockFetch(() => new Response("no", { status: 403 }));
    expect(await runFeedRefresh(forbidden.db as never, "feed-1")).toMatchObject({
      failureClass: "http_4xx",
      permanent: true,
    });

    const limited = createFeedRefreshDb();
    globalThis.fetch = mockFetch(() => new Response("slow down", { status: 429 }));
    expect(await runFeedRefresh(limited.db as never, "feed-1")).toMatchObject({
      failureClass: "http_4xx",
      permanent: false,
    });
  });

  test("reports server errors as retryable http_5xx", async () => {
    const fake = createFeedRefreshDb();
    globalThis.fetch = mockFetch(() => new Response("down", { status: 503 }));

    const result = await runFeedRefresh(fake.db as never, "feed-1");

    expect(result).toMatchObject({ ok: false, failureClass: "http_5xx", permanent: false });
  });

  test("reports transport failures as retryable network failures", async () => {
    const fake = createFeedRefreshDb();
    globalThis.fetch = mockFetch(() => {
      throw new Error("fetch failed");
    });

    const result = await runFeedRefresh(fake.db as never, "feed-1");

    expect(result).toMatchObject({ ok: false, failureClass: "network", permanent: false });
  });

  test("reports TLS certificate failures as permanent certificate failures", async () => {
    const fake = createFeedRefreshDb();
    globalThis.fetch = mockFetch(() => {
      throw new Error('ERR_TLS_CERT_ALTNAME_INVALID fetching "https://example.com/feed"');
    });

    const result = await runFeedRefresh(fake.db as never, "feed-1");

    expect(result).toMatchObject({ ok: false, failureClass: "certificate", permanent: true });
  });
});
