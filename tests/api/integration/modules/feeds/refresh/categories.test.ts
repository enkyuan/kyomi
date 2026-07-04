import { afterEach, describe, expect, test } from "bun:test";
import { getTableName } from "drizzle-orm";
import { runFeedRefresh, syncInferredFeedCategories } from "@kyomi/worker";

const originalFetch = globalThis.fetch;

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

function createFeedRefreshDb(options: { feed?: CapturedRow } = {}) {
  const feed = options.feed ?? {
    id: "feed-1",
    url: "https://example.com/feed.xml",
    link: "https://example.com/",
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
  const feedCategoryAssignments: CapturedRow[] = [];
  const feedItemCategoryAssignments: CapturedRow[] = [];

  const db = {
    updates,
    deletes,
    categories,
    feedItems,
    feedCategoryAssignments,
    feedItemCategoryAssignments,
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
        }
        return {
          onConflictDoUpdate: () => promiseQuery([]),
        };
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([feed]),
        }),
      }),
    }),
    transaction: async (callback: (tx: typeof db) => Promise<void>) => callback(db),
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
  test("persists RSS channel and item categories with feed provenance", async () => {
    const fake = createFeedRefreshDb();
    globalThis.fetch = async () => {
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
    };

    const result = await runFeedRefresh(fake as never, "feed-1", undefined, {
      enrichArticles: false,
    });

    expect(result.ok).toBe(true);
    // Explicit-provenance sync runs first, then the classifier sync (which finds explicit
    // labels already present and writes nothing) issues its own delete pass on both tables.
    expect(fake.deletes).toEqual([
      "feed_category_assignments",
      "feed_item_category_assignments",
      "feed_category_assignments",
      "feed_item_category_assignments",
    ]);
    expect(fake.categories.map((row) => row.label)).toEqual([
      "Technology",
      "JavaScript",
      "Programming",
    ]);
    expect(fake.categories.every((row) => row.provenance === "feed")).toBe(true);
    expect(labelsForAssignments(fake.feedCategoryAssignments, fake.categories)).toEqual([
      "Technology",
    ]);
    expect(labelsForAssignments(fake.feedItemCategoryAssignments, fake.categories)).toEqual([
      "JavaScript",
      "Programming",
    ]);
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
            inferredCategoryLabels: [{ label: "Security", confidence: 0.8 }],
          },
        ],
      },
      now,
    );

    expect(fake.deletes).toEqual(["feed_category_assignments", "feed_item_category_assignments"]);
    expect(fake.categories.map((row) => row.label)).toEqual(["Technology", "Security"]);
    expect(fake.feedCategoryAssignments).toMatchObject([
      { feedId: "feed-1", provenance: "classifier", confidence: 0.7 },
    ]);
    expect(fake.feedItemCategoryAssignments).toMatchObject([
      { feedItemId: "item-1", provenance: "classifier", confidence: 0.8 },
    ]);
  });

  test("does not write item classifier labels when an item has no inferred labels", async () => {
    const fake = createFeedRefreshDb();
    const now = new Date("2026-07-04T00:00:00.000Z");

    await syncInferredFeedCategories(
      fake as never,
      {
        feedId: "feed-1",
        feedCategories: [{ label: "General", confidence: 0.1 }],
        items: [{ id: "item-1", inferredCategoryLabels: [] }],
      },
      now,
    );

    expect(fake.feedCategoryAssignments).toHaveLength(1);
    expect(fake.feedItemCategoryAssignments).toHaveLength(0);
  });

  test("classifies a feed with no RSS categories during refresh", async () => {
    const fake = createFeedRefreshDb();
    globalThis.fetch = async () => {
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
    };

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
        faviconUrl: null,
        faviconSource: null,
        etag: null,
        lastModified: null,
        lastRefreshSucceededAt: null,
        lastRefreshFailedAt: null,
      },
    });
    globalThis.fetch = async () => {
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
    };

    const result = await runFeedRefresh(fake as never, "feed-1", undefined, {
      enrichArticles: false,
    });

    expect(result.ok).toBe(true);
    expect(labelsForAssignments(fake.feedItemCategoryAssignments, fake.categories)).toContain(
      "Security",
    );
  });
});
