import { afterEach, describe, expect, mock, test } from "bun:test";

const originalFetch = globalThis.fetch;
const originalEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  SKIP_ENV_VALIDATION: process.env.SKIP_ENV_VALIDATION,
  MEILI_URL: process.env.MEILI_URL,
  MEILI_MASTER_KEY: process.env.MEILI_MASTER_KEY,
  MEILI_INDEX_FEEDS: process.env.MEILI_INDEX_FEEDS,
};

async function loadSearchFeeds(envOverrides?: Record<string, string | undefined>) {
  process.env.DATABASE_URL =
    envOverrides?.DATABASE_URL ?? "postgres://test:test@localhost:5432/test";
  process.env.BETTER_AUTH_SECRET = envOverrides?.BETTER_AUTH_SECRET ?? "test-secret";
  process.env.SKIP_ENV_VALIDATION = envOverrides?.SKIP_ENV_VALIDATION ?? "true";
  process.env.MEILI_URL = envOverrides?.MEILI_URL;
  process.env.MEILI_MASTER_KEY = envOverrides?.MEILI_MASTER_KEY;
  process.env.MEILI_INDEX_FEEDS = envOverrides?.MEILI_INDEX_FEEDS;

  const mod = await import(`@modules/discover/feeds?test=${Date.now()}-${Math.random()}`);
  return mod.searchFeeds;
}

describe("discover feeds", () => {
  afterEach(() => {
    process.env.DATABASE_URL = originalEnv.DATABASE_URL;
    process.env.BETTER_AUTH_SECRET = originalEnv.BETTER_AUTH_SECRET;
    process.env.SKIP_ENV_VALIDATION = originalEnv.SKIP_ENV_VALIDATION;
    process.env.MEILI_URL = originalEnv.MEILI_URL;
    process.env.MEILI_MASTER_KEY = originalEnv.MEILI_MASTER_KEY;
    process.env.MEILI_INDEX_FEEDS = originalEnv.MEILI_INDEX_FEEDS;
    globalThis.fetch = originalFetch;
  });

  test("searchFeeds trims input and maps meili hits when configured", async () => {
    const searchFeeds = await loadSearchFeeds({
      MEILI_URL: "http://meili.local",
    });
    globalThis.fetch = mock((input: unknown) => {
      const href =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : typeof input === "object" && input !== null && "url" in input
              ? String((input as { url: unknown }).url)
              : "";
      if (href.endsWith("/indexes")) {
        return Promise.resolve(new Response(null, { status: 409 }));
      }
      if (href.includes("/settings/searchable-attributes")) {
        return Promise.resolve(new Response(null, { status: 202 }));
      }
      if (href.includes("/settings/filterable-attributes")) {
        return Promise.resolve(new Response(null, { status: 202 }));
      }
      if (href.endsWith("/search")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              hits: [
                {
                  id: "feed_1",
                  url: "https://example.com/feed.xml",
                  title: "Example &#8216;Feed&#8217;",
                  description: "Latest &amp; updates",
                  link: "https://example.com",
                  faviconUrl: null,
                },
              ],
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          ),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    }) as unknown as typeof fetch;

    const where = mock(() =>
      Promise.resolve([
        {
          id: "feed_1",
          url: "https://example.com/feed.xml",
          title: "Example &#8216;Feed&#8217;",
          description: "Latest &amp; updates",
          link: "https://example.com",
          faviconUrl: null,
          isSubscribed: true,
        },
      ]),
    );
    const leftJoin = mock(() => ({ where }));
    const from = mock(() => ({ leftJoin }));
    const select = mock(() => ({ from }));
    const fakeDb = { select } as unknown as Parameters<typeof searchFeeds>[0];

    const result = await searchFeeds(fakeDb, "user_1", "  example  ", 10);

    expect(result).toEqual([
      {
        id: "feed_1",
        url: "https://example.com/feed.xml",
        title: "Example ‘Feed’",
        description: "Latest & updates",
        link: "https://example.com",
        faviconUrl: null,
        isSubscribed: true,
      },
    ]);
  });

  test("searchFeeds makes stale Meili hits followable by URL", async () => {
    const searchFeeds = await loadSearchFeeds({
      MEILI_URL: "http://meili.local",
    });
    globalThis.fetch = mock((input: unknown) => {
      const href =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : typeof input === "object" && input !== null && "url" in input
              ? String((input as { url: unknown }).url)
              : "";
      if (href.endsWith("/indexes")) {
        return Promise.resolve(new Response(null, { status: 409 }));
      }
      if (href.includes("/settings/searchable-attributes")) {
        return Promise.resolve(new Response(null, { status: 202 }));
      }
      if (href.includes("/settings/filterable-attributes")) {
        return Promise.resolve(new Response(null, { status: 202 }));
      }
      if (href.endsWith("/search")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              hits: [
                {
                  id: "missing_feed",
                  url: "https://stale.example/feed.xml",
                  title: "Stale Feed",
                  description: "No longer in Postgres",
                  link: "https://stale.example",
                  faviconUrl: null,
                },
                {
                  id: "feed_1",
                  url: "https://example.com/feed.xml",
                  title: "Example Feed",
                  description: "Latest updates",
                  link: "https://example.com",
                  faviconUrl: null,
                },
              ],
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          ),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    }) as unknown as typeof fetch;

    const where = mock(() =>
      Promise.resolve([
        {
          id: "feed_1",
          url: "https://example.com/feed.xml",
          title: "Example Feed",
          description: "Latest updates",
          link: "https://example.com",
          faviconUrl: null,
          isSubscribed: false,
        },
      ]),
    );
    const leftJoin = mock(() => ({ where }));
    const from = mock(() => ({ leftJoin }));
    const select = mock(() => ({ from }));
    const fakeDb = { select } as unknown as Parameters<typeof searchFeeds>[0];
    const logger = { warn: mock(() => undefined) };

    const result = await searchFeeds(fakeDb, "user_1", "example", 10, logger);

    expect(result).toEqual([
      {
        id: null,
        url: "https://stale.example/feed.xml",
        title: "Stale Feed",
        description: "No longer in Postgres",
        link: "https://stale.example",
        faviconUrl: null,
        isSubscribed: false,
      },
      {
        id: "feed_1",
        url: "https://example.com/feed.xml",
        title: "Example Feed",
        description: "Latest updates",
        link: "https://example.com",
        faviconUrl: null,
        isSubscribed: false,
      },
    ]);
    expect(logger.warn).toHaveBeenCalledWith("discover.search.meili_stale_hits", {
      userId: "user_1",
      query: "example",
      limit: 10,
      staleHitCount: 1,
    });
  });

  test("searchFeeds returns an empty list for blank input", async () => {
    const searchFeeds = await loadSearchFeeds();
    const fakeDb = {} as Parameters<typeof searchFeeds>[0];
    const result = await searchFeeds(fakeDb, "user_1", "   ");
    expect(result).toEqual([]);
  });

  test("searchFeeds returns empty array and does not fall back to Postgres when Meili returns no hits", async () => {
    const searchFeeds = await loadSearchFeeds({
      MEILI_URL: "http://meili.local",
    });

    globalThis.fetch = mock((input: unknown) => {
      const href =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : typeof input === "object" && input !== null && "url" in input
              ? String((input as { url: unknown }).url)
              : "";
      if (href.endsWith("/indexes")) {
        return Promise.resolve(new Response(null, { status: 409 }));
      }
      if (href.includes("/settings/searchable-attributes")) {
        return Promise.resolve(new Response(null, { status: 202 }));
      }
      if (href.includes("/settings/filterable-attributes")) {
        return Promise.resolve(new Response(null, { status: 202 }));
      }
      if (href.endsWith("/search")) {
        return Promise.resolve(
          new Response(JSON.stringify({ hits: [] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    }) as unknown as typeof fetch;

    const limit = mock(() =>
      Promise.resolve([
        {
          id: "feed_1",
          url: "https://example.com/feed.xml",
          title: "Example Feed",
          description: "Latest updates",
          link: "https://example.com",
          isSubscribed: false,
          score: 0,
        },
      ]),
    );
    const orderBy = mock(() => ({ limit }));
    const where = mock(() => ({ orderBy }));
    const leftJoin = mock(() => ({ where }));
    const from = mock(() => ({ leftJoin }));
    const select = mock(() => ({ from }));
    const fakeDb = { select } as unknown as Parameters<typeof searchFeeds>[0];

    const result = await searchFeeds(fakeDb, "user_1", "example", 10);

    expect(result).toEqual([]);
    expect(select).not.toHaveBeenCalled();
  });
});
