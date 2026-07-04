import { afterEach, describe, expect, test } from "bun:test";
import { getTableName } from "drizzle-orm";
import { runFeedRefresh } from "@kyomi/worker";

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

function createFeedRefreshDb() {
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
          limit: () =>
            Promise.resolve([
              {
                id: "feed-1",
                url: "https://example.com/feed.xml",
                link: "https://example.com/",
                faviconUrl: "https://example.com/favicon.ico",
                faviconSource: "html_link",
                etag: null,
                lastModified: null,
                lastRefreshSucceededAt: null,
                lastRefreshFailedAt: null,
              },
            ]),
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
    expect(fake.deletes).toEqual(["feed_category_assignments", "feed_item_category_assignments"]);
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
});
