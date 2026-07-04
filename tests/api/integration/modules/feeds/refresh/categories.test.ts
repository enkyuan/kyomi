import { afterEach, describe, expect, test } from "bun:test";
import { getTableName, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  canonicalWinsOnConflictSql,
  runFeedRefresh,
  syncInferredFeedCategories,
} from "@kyomi/worker";

const originalFetch = globalThis.fetch;

function mockFetch(handler: () => Response | Promise<Response>): typeof fetch {
  return handler as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

type CapturedRow = Record<string, unknown>;

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
  options: { feed?: CapturedRow; existingFeedCategoryAssignments?: CapturedRow[] } = {},
) {
  const feed = options.feed ?? {
    id: "feed-1",
    url: "https://example.com/feed.xml",
    link: "https://example.com/",
    title: "Example Feed",
    description: "Updates",
    faviconUrl: "https://example.com/favicon.ico",
    faviconSource: "html_link",
    etag: null,
    lastModified: null,
    lastRefreshSucceededAt: null,
    lastRefreshFailedAt: null,
  };
  const updates: Array<{ table: string; patch: CapturedRow }> = [];
  const deletes: string[] = [];
  const categories: CapturedRow[] = [];
  const feedItems: CapturedRow[] = [];
  const feedCategoryAssignments: CapturedRow[] = [
    ...(options.existingFeedCategoryAssignments ?? []),
  ];
  const feedItemCategoryAssignments: CapturedRow[] = [];
  const feedItemTagAssignments: CapturedRow[] = [];

  const db = {
    updates,
    deletes,
    categories,
    feedItems,
    feedCategoryAssignments,
    feedItemCategoryAssignments,
    feedItemTagAssignments,
    update: (table: unknown) => ({
      set: (patch: CapturedRow) => {
        updates.push({ table: tableName(table), patch });
        return {
          where: () => Promise.resolve(),
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
        const rows = Array.isArray(input) ? input : [input];
        const name = tableName(table);
        if (name === "categories") {
          categories.push(...rows);
          return {
            onConflictDoUpdate: () =>
              promiseQuery(rows.map((row) => ({ id: row.id as string, slug: row.slug as string }))),
          };
        }
        if (name === "feed_items") {
          feedItems.push(...rows);
        } else if (name === "feed_category_assignments") {
          feedCategoryAssignments.push(...rows);
        } else if (name === "feed_item_category_assignments") {
          feedItemCategoryAssignments.push(...rows);
        } else if (name === "feed_item_tag_assignments") {
          feedItemTagAssignments.push(...rows);
        }
        return {
          onConflictDoUpdate: () => promiseQuery([]),
        };
      },
    }),
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: () => {
            if (tableName(table) === "feed_category_assignments") {
              return Promise.resolve(
                feedCategoryAssignments.filter((row) => row.provenance === "feed").slice(0, 1),
              );
            }
            return Promise.resolve([feed]);
          },
        }),
      }),
    }),
    transaction: async (callback: (tx: unknown) => Promise<void>) => callback(db),
  };

  return db;
}

function labelsForAssignments(assignments: CapturedRow[], categories: CapturedRow[]): string[] {
  return assignments.map((assignment) => {
    const category = categories.find((row) => row.id === assignment.categoryId);
    return category?.label as string;
  });
}

describe("runFeedRefresh category ingestion", () => {
  test("persists RSS channel and item categories mapped to canonical labels", async () => {
    const fake = createFeedRefreshDb();
    globalThis.fetch = mockFetch(async () => {
      const response = new Response(
        `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <title>Example Feed</title>
            <link>https://example.com/</link>
            <description>Updates</description>
            <category>Technology</category>
            <item>
              <title>First item</title>
              <link>https://example.com/first</link>
              <guid>first</guid>
              <description>Summary</description>
              <category>JavaScript</category>
              <category>Programming</category>
              <pubDate>Wed, 01 Jul 2026 00:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`,
        {
          status: 200,
          headers: { "content-type": "application/rss+xml" },
        },
      );
      Object.defineProperty(response, "url", { value: "https://example.com/feed.xml" });
      return response;
    });

    const result = await runFeedRefresh(fake as never, "feed-1", undefined, {
      enrichArticles: false,
    });

    expect(result.ok).toBe(true);
    // Explicit-provenance sync runs first, then the classifier sync (which finds explicit
    // canonical labels already present and writes nothing) issues its own delete pass on
    // both tables.
    expect(fake.deletes).toEqual([
      "feed_item_tag_assignments",
      "feed_category_assignments",
      "feed_item_category_assignments",
      "feed_category_assignments",
      "feed_item_category_assignments",
    ]);
    // Raw "JavaScript"/"Programming"/"Technology" source labels are canonicalized before
    // ever reaching the categories dictionary, so both map onto "Software Engineering" and
    // "Technology" stays as-is; no raw label is inserted as its own row.
    expect(fake.categories.map((row) => row.label)).toEqual(["Technology", "Software Engineering"]);
    expect(fake.categories.every((row) => row.provenance === "feed")).toBe(true);
    expect(labelsForAssignments(fake.feedCategoryAssignments, fake.categories)).toEqual([
      "Technology",
    ]);
    expect(labelsForAssignments(fake.feedItemCategoryAssignments, fake.categories)).toEqual([
      "Software Engineering",
    ]);
    expect(fake.feedItemTagAssignments.map((row) => row.label)).toEqual([
      "JavaScript",
      "Programming",
    ]);
    expect(result.categoryStats?.sourceTagAssignments).toBe(2);
  });

  test("does not insert a raw category row for an unmapped RSS label", async () => {
    const fake = createFeedRefreshDb();
    globalThis.fetch = mockFetch(async () => {
      const response = new Response(
        `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <title>Example Feed</title>
            <link>https://example.com/</link>
            <description>Updates</description>
            <item>
              <title>First item</title>
              <link>https://example.com/first</link>
              <guid>first</guid>
              <description>Summary</description>
              <category>#random-tag-2026</category>
              <pubDate>Wed, 01 Jul 2026 00:00:00 GMT</pubDate>
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
    expect(fake.categories.some((row) => row.provenance === "feed")).toBe(false);
    expect(fake.feedItemCategoryAssignments.some((row) => row.provenance === "feed")).toBe(false);
    expect(fake.feedItemTagAssignments.map((row) => row.label)).toEqual(["#random-tag-2026"]);
    expect(result.categoryStats?.sourceTagAssignments).toBe(1);
    // The feed has no explicit channel-level category at all, so the classifier fallback
    // still runs and fills in a canonical label from the feed title/description/domain.
    expect(fake.feedCategoryAssignments.some((row) => row.provenance === "classifier")).toBe(true);
  });

  test("persists classifier feed and item categories without touching explicit feed provenance", async () => {
    const fake = createFeedRefreshDb();
    const now = new Date("2026-07-04T00:00:00.000Z");

    await syncInferredFeedCategories(
      fake as never,
      {
        feedId: "feed-1",
        feedCategories: [{ label: "Technology", confidence: 0.7 }],
        items: [
          {
            id: "item-1",
            inferredCategoryLabels: [{ label: "Security & Privacy", confidence: 0.8 }],
          },
        ],
      },
      now,
    );

    expect(fake.deletes).toEqual(["feed_category_assignments", "feed_item_category_assignments"]);
    expect(fake.categories.map((row) => row.label)).toEqual(["Technology", "Security & Privacy"]);
    expect(fake.feedCategoryAssignments).toMatchObject([
      { feedId: "feed-1", provenance: "classifier", confidence: 0.7 },
    ]);
    expect(fake.feedItemCategoryAssignments).toMatchObject([
      { feedItemId: "item-1", provenance: "classifier", confidence: 0.8 },
    ]);
  });

  test("stamps model_id and taxonomy_version on classifier assignment rows", async () => {
    // The keyword classifier writes provenance fields (modelId, taxonomyVersion) so a
    // future re-classify pass can pick out stale rows. Locking in the expected values here
    // is the guard against a future refactor accidentally dropping the stamps and leaving
    // the DB unable to tell keyword-classifier rows from embedding-classifier rows.
    const fake = createFeedRefreshDb();
    const now = new Date("2026-07-04T00:00:00.000Z");

    await syncInferredFeedCategories(
      fake as never,
      {
        feedId: "feed-1",
        feedCategories: [{ label: "Technology", confidence: 0.7 }],
        items: [
          {
            id: "item-1",
            inferredCategoryLabels: [{ label: "Security & Privacy", confidence: 0.8 }],
          },
        ],
      },
      now,
    );

    expect(fake.feedCategoryAssignments).toMatchObject([
      { provenance: "classifier", modelId: "keyword-v1", taxonomyVersion: "v1" },
    ]);
    expect(fake.feedItemCategoryAssignments).toMatchObject([
      { provenance: "classifier", modelId: "keyword-v1", taxonomyVersion: "v1" },
    ]);
  });

  test("does not write item classifier labels when an item has no inferred labels", async () => {
    const fake = createFeedRefreshDb();
    const now = new Date("2026-07-04T00:00:00.000Z");

    await syncInferredFeedCategories(
      fake as never,
      {
        feedId: "feed-1",
        feedCategories: [{ label: "Miscellaneous", confidence: 0.1 }],
        items: [{ id: "item-1", inferredCategoryLabels: [] }],
      },
      now,
    );

    expect(fake.feedCategoryAssignments).toHaveLength(1);
    expect(fake.feedItemCategoryAssignments).toHaveLength(0);
  });

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

describe("canonicalWinsOnConflictSql", () => {
  test("lets a canonical incoming label win over a non-canonical existing label", () => {
    // Regression test: categories.slug is unique across all provenances, so a raw noisy label
    // (e.g. "MISCELLANEOUS") and the canonical label it happens to slug-collide with (e.g.
    // "Miscellaneous") can land on the same row. Without this branch, a classifier upsert that
    // lost the initial insert race would silently keep the non-canonical existing label
    // forever, and callers would attach new classifier assignments to a non-canonical row.
    const query = new PgDialect().sqlToQuery(
      canonicalWinsOnConflictSql(sql`existing_column`, sql`excluded.some_column`),
    );
    expect(query.sql).toContain("excluded.label IN (");
    expect(query.sql).toContain("NOT IN (");
    expect(query.sql).toContain("THEN excluded.some_column ELSE existing_column END");
    expect(query.params).toContain("Miscellaneous");
    expect(query.params).toContain("Software Engineering");
  });
});
