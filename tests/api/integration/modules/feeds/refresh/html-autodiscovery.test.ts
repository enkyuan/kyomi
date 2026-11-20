import { afterEach, describe, expect, mock, test } from "bun:test";
import { getTableName, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { isNonRetryableFeedRefreshFailure } from "@app/jobs/classify";
import { runFeedRefresh } from "@kyomi/ingest";

const originalFetch = globalThis.fetch;

type CapturedRow = Record<string, unknown>;
type RefreshState = {
  status: "queued" | "running" | "failed" | "idle";
  generation: number;
};

function mockFetch(
  handler: (input: Request | string | URL, init?: RequestInit) => Response | Promise<Response>,
): typeof fetch {
  return handler as unknown as typeof fetch;
}

function response(body: string, url: string, contentType: string): Response {
  const res = new Response(body, {
    status: 200,
    headers: { "content-type": contentType },
  });
  Object.defineProperty(res, "url", { value: url });
  return res;
}

function promiseQuery<T>(value: T) {
  const promise = Promise.resolve(value);
  return {
    returning: () => Promise.resolve(value),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
}

function tableName(table: unknown): string {
  return getTableName(table as Parameters<typeof getTableName>[0]);
}

function createFeedRefreshDb(
  options: {
    feed?: CapturedRow;
    claimResult?: { generation: number } | null;
    terminalResult?: CapturedRow | null;
    refreshState?: RefreshState;
    canonicalUrlConflict?: boolean;
  } = {},
) {
  const feed = options.feed ?? {
    id: "feed-1",
    url: "https://93.184.216.34/",
    link: "https://93.184.216.34/",
    submittedUrl: null,
    siteUrl: null,
    canonicalFeedUrl: null,
    discoveredFromUrl: null,
    discoveryProvenance: null,
    title: "Example",
    description: "Updates",
    sourceKind: "rss",
    faviconUrl: null,
    faviconSource: null,
    etag: '"cached"',
    lastModified: null,
    lastRefreshSucceededAt: null,
    lastRefreshFailedAt: null,
  };
  const updates: Array<{ table: string; patch: CapturedRow; whereClause?: string }> = [];
  const inserts: Record<string, CapturedRow[]> = {};
  const deletes: string[] = [];
  const dialect = new PgDialect();
  const claimResult = options.claimResult === undefined ? { generation: 0 } : options.claimResult;
  let returningCallCount = 0;

  const db = {
    updates,
    inserts,
    deletes,
    update: (table: unknown) => ({
      set: (patch: CapturedRow) => {
        const update: { table: string; patch: CapturedRow; whereClause?: string } = {
          table: tableName(table),
          patch,
        };
        updates.push(update);
        return {
          where: (condition: unknown) => {
            const query = dialect.sqlToQuery(condition as SQL);
            update.whereClause = query.sql;
            return {
              returning: () => {
                if (
                  options.canonicalUrlConflict &&
                  patch.refreshStatus === "idle" &&
                  typeof patch.url === "string"
                ) {
                  const error = Object.assign(
                    new Error('duplicate key value violates unique constraint "feeds_url_unique"'),
                    { code: "23505", constraint: "feeds_url_unique" },
                  );
                  return Promise.reject(new Error("Failed query", { cause: error }));
                }
                const refreshState = options.refreshState;
                if (refreshState) {
                  const matchesGeneration = query.params.includes(refreshState.generation);
                  if (patch.refreshStatus === "running") {
                    const mayClaimCurrentStatus = query.params.includes(refreshState.status);
                    if (!matchesGeneration || !mayClaimCurrentStatus) {
                      return Promise.resolve([]);
                    }
                    refreshState.status = "running";
                    return Promise.resolve([{ generation: refreshState.generation }]);
                  }
                  if (patch.refreshStatus === "failed" || patch.refreshStatus === "idle") {
                    if (!matchesGeneration) {
                      return Promise.resolve([]);
                    }
                    refreshState.status = patch.refreshStatus;
                    return Promise.resolve([{ id: "feed-1" }]);
                  }
                }
                const returningResult =
                  returningCallCount++ === 0
                    ? claimResult
                    : options.terminalResult === undefined
                      ? claimResult
                      : options.terminalResult;
                return Promise.resolve(returningResult ? [returningResult] : []);
              },
            };
          },
        };
      },
    }),
    delete: (table: unknown) => ({
      where: () => {
        deletes.push(tableName(table));
        return Promise.resolve();
      },
    }),
    insert: (table: unknown) => ({
      values: (input: CapturedRow | CapturedRow[]) => {
        const name = tableName(table);
        const rows = Array.isArray(input) ? input : [input];
        inserts[name] = [...(inserts[name] ?? []), ...rows];
        if (name === "categories") {
          return {
            onConflictDoUpdate: () =>
              promiseQuery(rows.map((row) => ({ id: row.id as string, slug: row.slug as string }))),
          };
        }
        return {
          onConflictDoUpdate: () => promiseQuery([]),
        };
      },
    }),
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          for: () => Promise.resolve(inserts.categories ?? []),
          limit: () => {
            if (tableName(table) === "feed_category_assignments") {
              return Promise.resolve([]);
            }
            return Promise.resolve([feed]);
          },
        }),
      }),
    }),
    execute: async () => ({ rows: [] }),
    transaction: async (callback: (tx: unknown) => Promise<void>) => callback(db),
  };

  return db;
}

function lastUpdateForTable(
  updates: Array<{ table: string; patch: CapturedRow }>,
  table: string,
): CapturedRow | undefined {
  for (let index = updates.length - 1; index >= 0; index -= 1) {
    const update = updates[index];
    if (update?.table === table) {
      return update.patch;
    }
  }
  return undefined;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("runFeedRefresh HTML autodiscovery", () => {
  test("does not fetch when its queued generation was superseded", async () => {
    const fake = createFeedRefreshDb({ claimResult: null });
    const fetchMock = mock(() => {
      throw new Error("stale refresh should not fetch");
    });
    globalThis.fetch = mockFetch(fetchMock);

    const result = await runFeedRefresh(fake as never, "feed-1", undefined, {
      refreshGeneration: 3,
    });

    expect(result).toMatchObject({ ok: true, skipped: "superseded", itemCount: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("reclaims a transiently failed generation when the queue retries its payload", async () => {
    const refreshState: RefreshState = { status: "queued", generation: 3 };
    const fake = createFeedRefreshDb({ refreshState });
    let fetchCalls = 0;
    globalThis.fetch = mockFetch((input, init) => {
      const url = input instanceof Request ? input.url : input.toString();
      // The feed request, not the favicon lookup that follows a refresh of the same site.
      const isFeedRequest = new Headers(init?.headers).get("accept")?.includes("rss");
      if (url !== "https://93.184.216.34/" || !isFeedRequest) {
        return new Response(null, { status: 404 });
      }
      fetchCalls += 1;
      if (fetchCalls === 1) {
        throw new Error("temporary upstream failure");
      }
      const res = new Response(null, { status: 304 });
      Object.defineProperty(res, "url", { value: "https://93.184.216.34/feed.xml" });
      return res;
    });

    const firstAttempt = await runFeedRefresh(fake as never, "feed-1", undefined, {
      refreshGeneration: 3,
    });
    expect(firstAttempt).toMatchObject({ ok: false, permanent: false });
    // The worker rethrows this result, so the queue re-enqueues the same generation instead of
    // ACKing it as a feed-owner failure.
    expect(isNonRetryableFeedRefreshFailure(firstAttempt)).toBe(false);
    expect(firstAttempt.ok || isNonRetryableFeedRefreshFailure(firstAttempt)).toBe(false);
    expect(refreshState.status).toBe("failed");

    const retry = await runFeedRefresh(fake as never, "feed-1", undefined, {
      refreshGeneration: 3,
    });
    expect(retry).toMatchObject({ ok: true, notModified: true, itemCount: 0 });
    // A successful worker result returns normally, which is the queue consumer's ACK path.
    expect(retry.ok || isNonRetryableFeedRefreshFailure(retry)).toBe(true);
    expect(refreshState.status).toBe("idle");
    expect(fetchCalls).toBe(2);
  });

  test("terminal state updates include the claimed generation", async () => {
    const fake = createFeedRefreshDb({ claimResult: { generation: 3 } });
    globalThis.fetch = mockFetch(() =>
      response(
        `<?xml version="1.0"?><rss version="2.0"><channel><title>Example Feed</title><link>https://93.184.216.34/</link><description>Latest updates</description><item><title>First</title><link>https://93.184.216.34/first</link><guid>first</guid></item></channel></rss>`,
        "https://93.184.216.34/feed.xml",
        "application/rss+xml",
      ),
    );

    const result = await runFeedRefresh(fake as never, "feed-1", undefined, {
      refreshGeneration: 3,
    });

    expect(result.ok).toBe(true);
    expect(fake.updates[0]?.patch).toMatchObject({
      refreshStatus: "running",
      lastRefreshStartedAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    const terminalUpdate = fake.updates.find(
      (update) => update.table === "feeds" && update.patch.refreshStatus === "idle",
    );
    expect(terminalUpdate?.whereClause).toContain("refresh_generation");
  });

  test("skips a successful refresh when its terminal generation was superseded", async () => {
    const fake = createFeedRefreshDb({
      claimResult: { generation: 3 },
      terminalResult: null,
    });
    globalThis.fetch = mockFetch(() =>
      response(
        `<?xml version="1.0"?><rss version="2.0"><channel><title>Example Feed</title><link>https://93.184.216.34/</link><description>Latest updates</description><item><title>First</title><link>https://93.184.216.34/first</link><guid>first</guid></item></channel></rss>`,
        "https://93.184.216.34/feed.xml",
        "application/rss+xml",
      ),
    );

    const result = await runFeedRefresh(fake as never, "feed-1", undefined, {
      refreshGeneration: 3,
    });

    expect(result).toMatchObject({ ok: true, skipped: "superseded", itemCount: 0 });
    expect(fake.inserts.feed_items).toBeUndefined();
    expect(fake.inserts.categories).toBeUndefined();
    expect(fake.deletes).toEqual([]);
  });

  test("skips a transient fetch failure when its terminal generation was superseded", async () => {
    const fake = createFeedRefreshDb({
      claimResult: { generation: 3 },
      terminalResult: null,
    });
    globalThis.fetch = mockFetch(() => {
      throw new Error("temporary upstream failure");
    });

    const result = await runFeedRefresh(fake as never, "feed-1", undefined, {
      refreshGeneration: 3,
    });

    expect(result).toMatchObject({ ok: true, skipped: "superseded", itemCount: 0 });
  });

  test("skips a not-modified refresh when its terminal generation was superseded", async () => {
    const fake = createFeedRefreshDb({
      claimResult: { generation: 3 },
      terminalResult: null,
    });
    globalThis.fetch = mockFetch(() => {
      const res = new Response(null, { status: 304 });
      Object.defineProperty(res, "url", { value: "https://93.184.216.34/feed.xml" });
      return res;
    });

    const result = await runFeedRefresh(fake as never, "feed-1", undefined, {
      refreshGeneration: 3,
    });

    expect(result).toMatchObject({ ok: true, skipped: "superseded", itemCount: 0 });
  });

  test("retains the exact request path across the first and conditional catalog refreshes", async () => {
    const url = "https://93.184.216.34/feed";
    const submittedUrl = url + "/";
    const feed = {
      id: "feed-1",
      url,
      submittedUrl,
      subscriberCount: 0,
      title: "Example",
      etag: '"previous-path"',
    };
    const fake = createFeedRefreshDb({ feed });
    globalThis.fetch = mockFetch((input, init) => {
      expect(input.toString()).toBe(submittedUrl);
      expect(new Headers(init?.headers).get("if-none-match")).toBeNull();
      return response(
        "<rss><channel><title>Example</title></channel></rss>",
        submittedUrl,
        "application/rss+xml",
      );
    });
    const options = { catalogRefreshIntervalMs: 86_400_000 };
    expect((await runFeedRefresh(fake as never, "feed-1", undefined, options)).ok).toBe(true);
    const updated = lastUpdateForTable(fake.updates, "feeds");
    expect(updated?.canonicalFeedUrl).toBe(submittedUrl);
    const next = createFeedRefreshDb({ feed: { ...feed, ...updated, etag: '"exact-path"' } });
    globalThis.fetch = mockFetch((input, init) => {
      expect(input.toString()).toBe(submittedUrl);
      expect(new Headers(init?.headers).get("if-none-match")).toBe('"exact-path"');
      return new Response(null, { status: 304 });
    });
    expect((await runFeedRefresh(next as never, "feed-1", undefined, options)).ok).toBe(true);
  });

  test("fetches an RSS alternate from HTML and updates canonical feed provenance", async () => {
    const siteUrl = "https://93.184.216.34/";
    const feedUrl = "https://93.184.216.34/feed.xml";
    const fake = createFeedRefreshDb();

    globalThis.fetch = mockFetch(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url === siteUrl) {
        return response(
          `<!doctype html><html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head></html>`,
          siteUrl,
          "text/html",
        );
      }
      if (url === feedUrl) {
        return response(
          `<?xml version="1.0"?><rss version="2.0"><channel><title>Example Feed</title><link>${siteUrl}</link><description>Latest updates</description><item><title>First</title><link>${siteUrl}first</link><guid>first</guid></item></channel></rss>`,
          feedUrl,
          "application/rss+xml",
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const result = await runFeedRefresh(fake as never, "feed-1");

    expect(result.ok).toBe(true);
    expect(result.itemCount).toBe(1);
    const feedUpdate = lastUpdateForTable(fake.updates, "feeds");
    expect(feedUpdate).toMatchObject({
      url: feedUrl,
      submittedUrl: siteUrl,
      siteUrl,
      canonicalFeedUrl: feedUrl,
      discoveredFromUrl: siteUrl,
      discoveryProvenance: "scheduled_html_autodiscovery",
      refreshStatus: "idle",
      lastRefreshError: null,
    });
  });

  test.each([
    ["/feed", "Example", true],
    ["/feed", "Different publication", false],
    ["/category/books/feed", "Example", false],
  ] as const)(
    "a missing catalog endpoint %s only adopts the same publication (%s)",
    async (path, title, recovered) => {
      const home = "https://93.184.216.34/";
      const fake = createFeedRefreshDb({
        feed: {
          id: "feed-1",
          url: new URL(path, home).href,
          link: home,
          title: "Example",
          subscriberCount: 0,
          lastRefreshSucceededAt: null,
          lastRefreshFailedAt: null,
          sourceKind: "rss",
          description: "Example",
        },
      });
      globalThis.fetch = mockFetch((input) => {
        const url = input instanceof Request ? input.url : input.toString();
        if (url === home)
          return response(
            '<html><head><link rel="alternate" type="application/rss+xml" href="/rss.xml"></head></html>',
            home,
            "text/html",
          );
        if (url === home + "rss.xml")
          return response(
            `<rss><channel><title>${title}</title><link>${home}</link></channel></rss>`,
            url,
            "application/rss+xml",
          );
        return new Response(null, { status: 404 });
      });
      const result = await runFeedRefresh(fake as never, "feed-1", undefined, {
        catalogRefreshIntervalMs: 86_400_000,
      });
      expect(result.ok, result.error).toBe(recovered);
      if (recovered)
        expect(lastUpdateForTable(fake.updates, "feeds")).toMatchObject({
          url: home + "rss.xml",
          discoveryProvenance: "catalog_homepage_alternate",
        });
      else expect(result.failureClass).toBe("http_404");
    },
  );

  test("keeps the existing feed URL when an autodiscovered canonical URL is already owned", async () => {
    const siteUrl = "https://93.184.216.34/";
    const feedUrl = "https://93.184.216.34/feed.xml";
    const fake = createFeedRefreshDb({ canonicalUrlConflict: true });

    globalThis.fetch = mockFetch((input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url === siteUrl) {
        return response(
          '<!doctype html><html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head></html>',
          siteUrl,
          "text/html",
        );
      }
      return response(
        `<?xml version="1.0"?><rss version="2.0"><channel><title>Example Feed</title><link>${siteUrl}</link><description>Latest updates</description></channel></rss>`,
        feedUrl,
        "application/rss+xml",
      );
    });

    const result = await runFeedRefresh(fake as never, "feed-1");

    expect(result.ok).toBe(true);
    const feedUpdate = lastUpdateForTable(fake.updates, "feeds");
    expect(feedUpdate).toMatchObject({
      canonicalFeedUrl: feedUrl,
      discoveredFromUrl: siteUrl,
      discoveryProvenance: "scheduled_html_autodiscovery",
      refreshStatus: "idle",
      lastRefreshError: null,
    });
    expect(feedUpdate).not.toHaveProperty("url");
  });

  test("returns a permanent html_not_feed failure when HTML has no feed alternate", async () => {
    const fake = createFeedRefreshDb();
    globalThis.fetch = mockFetch(() =>
      response(
        "<!doctype html><html><head><title>Example</title></head><body>No feeds here.</body></html>",
        "https://93.184.216.34/",
        "text/html",
      ),
    );

    const result = await runFeedRefresh(fake as never, "feed-1");

    expect(result).toMatchObject({
      ok: false,
      permanent: true,
      failureClass: "html_not_feed",
      error: "Feed returned HTML (html_not_feed): no feed alternate found",
    });
    const failedUpdate = fake.updates.at(-1)?.patch;
    expect(failedUpdate?.refreshStatus).toBe("failed");
    expect(failedUpdate?.lastRefreshError).toBe(
      "Feed returned HTML (html_not_feed): no feed alternate found",
    );
    expect((failedUpdate?.nextRefreshAt as Date).getTime()).toBeGreaterThan(
      Date.now() + 23 * 60 * 60 * 1000,
    );
  });

  test.each([
    ["login_html", "<!doctype html><html><body>Please sign in to continue.</body></html>"],
    [
      "captcha_html",
      "<!doctype html><html><body>Cloudflare checking your browser captcha</body></html>",
    ],
    [
      "access_denied_html",
      "<!doctype html><html><body>Access denied. Request blocked.</body></html>",
    ],
    ["stale_endpoint_html", "<!doctype html><html><body>Feed no longer exists.</body></html>"],
  ] as const)("classifies %s HTML failures", async (failureClass, body) => {
    const fake = createFeedRefreshDb();
    globalThis.fetch = mockFetch(() =>
      response(body, "https://93.184.216.34/feed.xml", "text/html"),
    );

    const result = await runFeedRefresh(fake as never, "feed-1");

    expect(result.ok).toBe(false);
    expect(result.failureClass).toBe(failureClass);
  });

  test("blocks unsafe discovered alternates as feed-owner HTML failures", async () => {
    const fake = createFeedRefreshDb();
    let fetchCount = 0;
    globalThis.fetch = mockFetch((input) => {
      fetchCount += 1;
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url !== "https://93.184.216.34/") {
        throw new Error(`unsafe URL should not be fetched: ${url}`);
      }
      return response(
        `<!doctype html><html><head><link rel="alternate" type="application/rss+xml" href="http://127.0.0.1/feed.xml"></head></html>`,
        "https://93.184.216.34/",
        "text/html",
      );
    });

    const result = await runFeedRefresh(fake as never, "feed-1");

    expect(fetchCount).toBe(1);
    expect(result.ok).toBe(false);
    expect(result.permanent).toBe(true);
    expect(result.error).toContain(
      "discovered alternate fetch failed: Private network URLs are not allowed",
    );
  });

  describe("a login in a URL that would become the stored feed URL", () => {
    const login = "https://reader:s3cret@93.184.216.35/feed.xml";
    const feedXml = (siteUrl: string) =>
      `<?xml version="1.0"?><rss version="2.0"><channel><title>Moved</title><link>${siteUrl}</link><description>d</description><item><title>First</title><link>${siteUrl}first</link><guid>first</guid></item></channel></rss>`;
    const urlOf = (input: Request | string | URL) =>
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    test("refuses a feed that redirects to a URL with a login, writing none of it", async () => {
      const fake = createFeedRefreshDb();
      const seen: string[] = [];
      globalThis.fetch = mockFetch((input) => {
        seen.push(urlOf(input));
        return urlOf(input) === "https://93.184.216.34/"
          ? new Response(null, { status: 302, headers: { location: login } })
          : response(feedXml("https://93.184.216.35/"), login, "application/rss+xml");
      });

      const result = await runFeedRefresh(fake as never, "feed-1");

      expect(result).toMatchObject({
        ok: false,
        error: "Feed fetch failed: Feed URLs with a username or password are not supported",
      });
      // The redirect is still followed; the document it led to is not accepted.
      expect(seen).toHaveLength(2);
      expect(JSON.stringify(fake.updates)).not.toContain("s3cret");
      expect(fake.inserts.feed_items ?? []).toEqual([]);
    });

    test("refuses an autodiscovered alternate that carries a login", async () => {
      const fake = createFeedRefreshDb();
      const seen: string[] = [];
      globalThis.fetch = mockFetch((input) => {
        seen.push(urlOf(input));
        return response(
          `<!doctype html><html><head><link rel="alternate" type="application/rss+xml" href="${login}"></head></html>`,
          "https://93.184.216.34/",
          "text/html",
        );
      });

      const result = await runFeedRefresh(fake as never, "feed-1");

      expect(seen).toEqual(["https://93.184.216.34/"]);
      expect(result).toMatchObject({ ok: false, failureClass: "html_not_feed" });
      expect(JSON.stringify(fake.updates)).not.toContain("s3cret");
    });

    test("refuses an autodiscovered alternate that redirects to a URL with a login", async () => {
      const fake = createFeedRefreshDb();
      globalThis.fetch = mockFetch((input) => {
        const url = urlOf(input);
        if (url === "https://93.184.216.34/") {
          return response(
            `<!doctype html><html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head></html>`,
            url,
            "text/html",
          );
        }
        return url === "https://93.184.216.34/feed.xml"
          ? new Response(null, { status: 302, headers: { location: login } })
          : response(feedXml("https://93.184.216.35/"), login, "application/rss+xml");
      });

      const result = await runFeedRefresh(fake as never, "feed-1");

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Feed URLs with a username or password are not supported");
      expect(JSON.stringify(fake.updates)).not.toContain("s3cret");
    });

    test("still adopts the URL a feed redirects to when it is an ordinary one", async () => {
      const fake = createFeedRefreshDb();
      const movedUrl = "https://93.184.216.35/new.xml";
      globalThis.fetch = mockFetch((input) =>
        urlOf(input) === "https://93.184.216.34/"
          ? new Response(null, { status: 301, headers: { location: movedUrl } })
          : response(feedXml("https://93.184.216.35/"), movedUrl, "application/rss+xml"),
      );

      const result = await runFeedRefresh(fake as never, "feed-1");

      expect(result.ok).toBe(true);
      expect(lastUpdateForTable(fake.updates, "feeds")).toMatchObject({
        url: movedUrl,
        canonicalFeedUrl: movedUrl,
        refreshStatus: "idle",
      });
    });
  });

  test("does not recursively crawl when the discovered alternate is also HTML", async () => {
    const fake = createFeedRefreshDb();
    const seen: string[] = [];
    globalThis.fetch = mockFetch((input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      seen.push(url);
      if (url === "https://93.184.216.34/") {
        return response(
          `<!doctype html><html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head></html>`,
          url,
          "text/html",
        );
      }
      return response(
        `<!doctype html><html><head><link rel="alternate" type="application/rss+xml" href="/another.xml"></head></html>`,
        url,
        "text/html",
      );
    });

    const result = await runFeedRefresh(fake as never, "feed-1");

    expect(seen).toEqual(["https://93.184.216.34/", "https://93.184.216.34/feed.xml"]);
    expect(result.ok).toBe(false);
    expect(result.permanent).toBe(true);
  });
});
