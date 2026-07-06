import { afterEach, describe, expect, test } from "bun:test";
import { runFeedRefresh } from "@kyomi/worker";
import {
  createFeedRefreshDb,
  labelsForAssignments,
  mockFetch,
  restoreFetch,
} from "./category-test-helpers";

afterEach(restoreFetch);

describe("runFeedRefresh classifier fallback", () => {
  test("classifies a feed with no RSS categories during refresh", async () => {
    const fake = createFeedRefreshDb();
    globalThis.fetch = mockFetch(async () => {
      const response = new Response(
        `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <title>Airbnb Engineering</title>
            <link>https://medium.com/airbnb-engineering</link>
            <description>Software engineering posts about infrastructure and architecture.</description>
            <item>
              <title>Building a fault-tolerant metrics storage system at Airbnb</title>
              <link>https://medium.com/airbnb-engineering/metrics-storage</link>
              <guid>metrics-storage</guid>
              <description>Infrastructure architecture for reliable metrics.</description>
              <pubDate>Wed, 01 Jul 2026 00:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`,
        { status: 200, headers: { "content-type": "application/rss+xml" } },
      );
      Object.defineProperty(response, "url", {
        value: "https://medium.com/feed/airbnb-engineering",
      });
      return response;
    });

    const result = await runFeedRefresh(fake as never, "feed-1", undefined, {
      enrichArticles: false,
    });

    expect(result.ok).toBe(true);
    expect(labelsForAssignments(fake.feedCategoryAssignments, fake.categories)).toContain(
      "Software Engineering",
    );
    expect(fake.feedCategoryAssignments.some((row) => row.provenance === "classifier")).toBe(true);
  });

  test("classifies mixed-feed items when RSS categories are absent", async () => {
    const fake = createFeedRefreshDb({
      feed: {
        id: "feed-1",
        url: "https://news.ycombinator.com/rss",
        link: "https://news.ycombinator.com",
        title: "Hacker News",
        description: "Links for hackers",
        faviconUrl: null,
        faviconSource: null,
        etag: null,
        lastModified: null,
        lastRefreshSucceededAt: null,
        lastRefreshFailedAt: null,
      },
    });
    globalThis.fetch = mockFetch(async () => {
      const response = new Response(
        `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <title>Hacker News</title>
            <link>https://news.ycombinator.com</link>
            <description>Links for hackers</description>
            <item>
              <title>MSI Center - How to gain SYSTEM privileges in seconds</title>
              <link>https://mrbruh.com/msi-center-privilege-escalation</link>
              <guid>security-story</guid>
              <description>A local privilege escalation vulnerability gives SYSTEM access.</description>
              <pubDate>Wed, 01 Jul 2026 00:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`,
        { status: 200, headers: { "content-type": "application/rss+xml" } },
      );
      Object.defineProperty(response, "url", { value: "https://news.ycombinator.com/rss" });
      return response;
    });

    const result = await runFeedRefresh(fake as never, "feed-1", undefined, {
      enrichArticles: false,
    });

    expect(result.ok).toBe(true);
    expect(labelsForAssignments(fake.feedItemCategoryAssignments, fake.categories)).toContain(
      "Security & Privacy",
    );
    expect(fake.feedCategoryAssignments.some((row) => row.provenance === "classifier")).toBe(false);
    expect(result.categoryStats).toMatchObject({
      feedClassifierLabels: 0,
      itemClassifierLabels: 1,
      itemClassifierAbstentions: 0,
      suppressedFeedClassifierFallback: true,
    });
  });

  test("suppresses classifier feed fallback for broad feeds when item signal is absent", async () => {
    const fake = createFeedRefreshDb({
      feed: {
        id: "feed-1",
        url: "https://news.ycombinator.com/rss",
        link: "https://news.ycombinator.com",
        title: "Hacker News",
        description: "Links for hackers",
        faviconUrl: null,
        faviconSource: null,
        etag: null,
        lastModified: null,
        lastRefreshSucceededAt: null,
        lastRefreshFailedAt: null,
      },
    });
    globalThis.fetch = mockFetch(async () => {
      const response = new Response(
        `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <title>Hacker News</title>
            <link>https://news.ycombinator.com</link>
            <description>Links for hackers</description>
            <item>
              <title>Launch notes</title>
              <link>https://example.com/launch-notes</link>
              <guid>launch-notes</guid>
              <description>Comments and discussion.</description>
              <pubDate>Wed, 01 Jul 2026 00:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`,
        { status: 200, headers: { "content-type": "application/rss+xml" } },
      );
      Object.defineProperty(response, "url", { value: "https://news.ycombinator.com/rss" });
      return response;
    });

    const result = await runFeedRefresh(fake as never, "feed-1", undefined, {
      enrichArticles: false,
    });

    expect(result.ok).toBe(true);
    expect(fake.feedCategoryAssignments.some((row) => row.provenance === "classifier")).toBe(false);
    expect(fake.feedItemCategoryAssignments).toHaveLength(0);
    expect(result.categoryStats).toMatchObject({
      feedClassifierLabels: 0,
      itemClassifierLabels: 0,
      itemClassifierAbstentions: 1,
      suppressedFeedClassifierFallback: true,
    });
  });

  test("classifies item-level categories for non-allowlisted feeds", async () => {
    const fake = createFeedRefreshDb({
      feed: {
        id: "feed-1",
        url: "https://example.com/feed.xml",
        link: "https://example.com",
        title: "Daily Links",
        description: "A mixed collection of links from across the web.",
        faviconUrl: null,
        faviconSource: null,
        etag: null,
        lastModified: null,
        lastRefreshSucceededAt: null,
        lastRefreshFailedAt: null,
      },
    });
    globalThis.fetch = mockFetch(async () => {
      const response = new Response(
        `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <title>Daily Links</title>
            <link>https://example.com</link>
            <description>A mixed collection of links from across the web.</description>
            <item>
              <title>Open weights language model released</title>
              <link>https://huggingface.co/blog/open-model-release</link>
              <guid>ai-story</guid>
              <description>The transformer model uses embeddings and agent training data.</description>
              <pubDate>Wed, 01 Jul 2026 00:00:00 GMT</pubDate>
            </item>
            <item>
              <title>Bitcoin market rally lifts crypto stocks</title>
              <link>https://finance.yahoo.com/news/bitcoin-market-rally</link>
              <guid>finance-story</guid>
              <description>Investors watch the market, stock prices, and crypto trading volume.</description>
              <pubDate>Wed, 01 Jul 2026 01:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`,
        { status: 200, headers: { "content-type": "application/rss+xml" } },
      );
      Object.defineProperty(response, "url", { value: "https://example.com/feed.xml" });
      return response;
    });

    const result = await runFeedRefresh(fake as never, "feed-1", undefined, {
      enrichArticles: false,
    });

    expect(result.ok).toBe(true);
    const itemLabels = labelsForAssignments(fake.feedItemCategoryAssignments, fake.categories);
    expect(itemLabels).toContain("AI & ML");
    expect(itemLabels).toContain("Finance & Markets");
    expect(fake.feedItemCategoryAssignments.every((row) => row.provenance === "classifier")).toBe(
      true,
    );
  });

  test("counts embedding classifier failures without failing feed refresh", async () => {
    const fake = createFeedRefreshDb({
      feed: {
        id: "feed-1",
        url: "https://example.com/feed.xml",
        link: "https://example.com",
        title: "Daily Links",
        description: "A mixed collection of links from across the web.",
        faviconUrl: null,
        faviconSource: null,
        etag: null,
        lastModified: null,
        lastRefreshSucceededAt: null,
        lastRefreshFailedAt: null,
      },
    });
    globalThis.fetch = (async (url: string) => {
      if (url === "https://fake.voyage.test/v1/embeddings") {
        return new Response("rate limited", { status: 429 });
      }
      const response = new Response(
        `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <title>Daily Links</title>
            <link>https://example.com</link>
            <description>A mixed collection of links from across the web.</description>
            <item>
              <title>Open weights language model released</title>
              <link>https://huggingface.co/blog/open-model-release</link>
              <guid>ai-story</guid>
              <description>The transformer model uses embeddings and agent training data.</description>
              <pubDate>Wed, 01 Jul 2026 00:00:00 GMT</pubDate>
            </item>
            <item>
              <title>Bitcoin market rally lifts crypto stocks</title>
              <link>https://finance.yahoo.com/news/bitcoin-market-rally</link>
              <guid>finance-story</guid>
              <description>Investors watch the market, stock prices, and crypto trading volume.</description>
              <pubDate>Wed, 01 Jul 2026 01:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`,
        { status: 200, headers: { "content-type": "application/rss+xml" } },
      );
      Object.defineProperty(response, "url", { value: "https://example.com/feed.xml" });
      return response;
    }) as unknown as typeof fetch;

    const result = await runFeedRefresh(fake as never, "feed-1", undefined, {
      enrichArticles: false,
      embeddingClassifier: {
        apiKey: "test-key",
        apiUrl: "https://fake.voyage.test/v1/embeddings",
      },
    });

    expect(result.ok).toBe(true);
    expect(labelsForAssignments(fake.feedItemCategoryAssignments, fake.categories)).toContain(
      "AI & ML",
    );
    expect(result.categoryStats?.embeddingClassifier).toMatchObject({
      configured: true,
      feedClassifierLabels: 0,
      feedClassifierFailures: 1,
      itemClassifierLabels: 0,
      itemClassifierFailures: 2,
    });
  });

  test("classifies feed-level categories from stored metadata on a 304 Not Modified response", async () => {
    const fake = createFeedRefreshDb({
      feed: {
        id: "feed-1",
        url: "https://techcrunch.com/feed",
        link: "https://techcrunch.com",
        title: "TechCrunch",
        description: "Startup and technology news, funding, and product launches.",
        faviconUrl: "https://techcrunch.com/favicon.ico",
        faviconSource: "html_link",
        etag: "etag-1",
        lastModified: null,
        lastRefreshSucceededAt: null,
        lastRefreshFailedAt: null,
      },
    });
    globalThis.fetch = mockFetch(() => new Response(null, { status: 304 }));

    const result = await runFeedRefresh(fake as never, "feed-1", undefined, {
      enrichArticles: false,
    });

    expect(result.ok).toBe(true);
    expect(result.notModified).toBe(true);
    expect(fake.feedItemCategoryAssignments).toHaveLength(0);
    expect(fake.feedCategoryAssignments.some((row) => row.provenance === "classifier")).toBe(true);
    expect(result.categoryStats).toMatchObject({
      feedClassifierLabels: 2,
      itemClassifierLabels: 0,
      itemClassifierAbstentions: 0,
      suppressedFeedClassifierFallback: false,
    });
  });

  test("suppresses classifier feed fallback on a broad-feed 304 response", async () => {
    const fake = createFeedRefreshDb({
      feed: {
        id: "feed-1",
        url: "https://news.ycombinator.com/rss",
        link: "https://news.ycombinator.com",
        title: "Hacker News",
        description: "Links for hackers",
        faviconUrl: null,
        faviconSource: null,
        etag: "etag-1",
        lastModified: null,
        lastRefreshSucceededAt: null,
        lastRefreshFailedAt: null,
      },
    });
    globalThis.fetch = mockFetch(() => new Response(null, { status: 304 }));

    const result = await runFeedRefresh(fake as never, "feed-1", undefined, {
      enrichArticles: false,
    });

    expect(result.ok).toBe(true);
    expect(result.notModified).toBe(true);
    expect(fake.feedCategoryAssignments).toHaveLength(0);
    expect(fake.deletes).toContain("feed_category_assignments");
    expect(result.categoryStats).toMatchObject({
      feedClassifierLabels: 0,
      itemClassifierLabels: 0,
      itemClassifierAbstentions: 0,
      suppressedFeedClassifierFallback: true,
    });
  });

  test("skips classifier fallback on a 304 when the feed already has explicit categories", async () => {
    const fake = createFeedRefreshDb({
      feed: {
        id: "feed-1",
        url: "https://techcrunch.com/feed",
        link: "https://techcrunch.com",
        title: "TechCrunch",
        description: "Startup and technology news, funding, and product launches.",
        faviconUrl: "https://techcrunch.com/favicon.ico",
        faviconSource: "html_link",
        etag: "etag-1",
        lastModified: null,
        lastRefreshSucceededAt: null,
        lastRefreshFailedAt: null,
      },
      existingFeedCategoryAssignments: [
        { id: "assignment-1", feedId: "feed-1", categoryId: "category-1", provenance: "feed" },
      ],
    });
    globalThis.fetch = mockFetch(() => new Response(null, { status: 304 }));

    const result = await runFeedRefresh(fake as never, "feed-1", undefined, {
      enrichArticles: false,
    });

    expect(result.ok).toBe(true);
    expect(result.notModified).toBe(true);
    // Only the pre-seeded explicit assignment should be present; no classifier rewrite ran.
    expect(fake.feedCategoryAssignments).toHaveLength(1);
    expect(fake.deletes).toEqual([]);
  });
});
