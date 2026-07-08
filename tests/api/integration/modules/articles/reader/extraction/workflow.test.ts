import { afterEach, describe, expect, mock, test } from "bun:test";
import { getTableName } from "drizzle-orm";
import { articleExtractionCache, feedItems } from "@kyomi/db";
import {
  requestFullTextExtractionForUser,
  runArticleExtractionForUser,
} from "@modules/articles/reader/extraction/workflow";

const originalFetch = globalThis.fetch;
const PERFORMANCE_DEV_LINEAR_FIXTURE = new URL(
  "../../../../../fixtures/articles/performance-dev-linear.html",
  import.meta.url,
);

type CapturedRow = Record<string, unknown>;

type FakeCacheRow = {
  id: string;
  urlKey: string;
  sourceUrl: string;
  finalUrl: string | null;
  contentHash: string | null;
  contentHtml: string | null;
  contentText: string | null;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  fetchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

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

function feedRow(overrides: CapturedRow = {}) {
  return {
    id: "item-1",
    title: "How's Linear so fast?",
    link: "https://93.184.216.34/how-is-linear-so-fast-a-technical-breakdown",
    summary: "A technical breakdown.",
    content: null,
    contentHtml: "<p>Original feed summary</p>",
    contentText: "Original feed summary",
    contentMarkdown: null,
    contentStatus: "ready",
    contentSource: "feed_html",
    extractionErrorCode: null,
    extractionErrorMessage: null,
    extractedContentHtml: null,
    extractedContentText: null,
    extractedContentStatus: "pending",
    extractedContentError: null,
    extractedContentUpdatedAt: null,
    publishedAt: new Date("2026-07-01T00:00:00.000Z"),
    feedId: "feed-1",
    feedUrl: "https://example.com/feed.xml",
    feedSiteUrl: "https://example.com",
    feedTitle: "performance.dev",
    feedFaviconUrl: null,
    isRead: false,
    isSaved: false,
    categories: [],
    ...overrides,
  };
}

function cacheRow(overrides: Partial<FakeCacheRow> = {}): FakeCacheRow {
  const now = new Date("2026-07-08T12:00:00.000Z");
  return {
    id: "article_extract_1",
    urlKey: "https://93.184.216.34/how-is-linear-so-fast-a-technical-breakdown",
    sourceUrl: "https://93.184.216.34/how-is-linear-so-fast-a-technical-breakdown",
    finalUrl: "https://93.184.216.34/how-is-linear-so-fast-a-technical-breakdown",
    contentHash: "hash",
    contentHtml: "<article><p>Cached ready full text.</p></article>",
    contentText: "Cached ready full text.",
    status: "ready",
    errorCode: null,
    errorMessage: null,
    fetchedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createExtractionDb(options: { item?: CapturedRow; cache?: FakeCacheRow | null } = {}) {
  const item = options.item ?? feedRow();
  let cache = options.cache ?? null;
  const updates: Array<{ table: string; patch: CapturedRow }> = [];
  const cacheWrites: Array<{ values: CapturedRow; set: CapturedRow }> = [];

  const db = {
    item,
    updates,
    cacheWrites,
    get cache() {
      return cache;
    },
    select: () => ({
      from: (table: unknown) => {
        const name = tableName(table);

        if (name === "feed_items") {
          return {
            leftJoin: () => ({
              innerJoin: () => ({
                leftJoin: () => ({
                  where: () => ({
                    limit: () => Promise.resolve([item]),
                  }),
                }),
              }),
            }),
          };
        }

        if (name === "article_clips") {
          return {
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          };
        }

        if (name === "article_extraction_cache") {
          return {
            where: () => ({
              limit: () => Promise.resolve(cache ? [cache] : []),
            }),
          };
        }

        if (name === "feed_item_category_assignments") {
          return {
            innerJoin: () => ({
              where: () => Promise.resolve([]),
            }),
          };
        }

        throw new Error(`Unexpected select from ${name}`);
      },
    }),
    update: (table: unknown) => ({
      set: (patch: CapturedRow) => {
        const name = tableName(table);
        updates.push({ table: name, patch });
        if (name === "feed_items") {
          Object.assign(item, patch);
        }
        return {
          where: () => Promise.resolve(),
        };
      },
    }),
    insert: (table: unknown) => ({
      values: (values: CapturedRow) => {
        const name = tableName(table);
        if (name !== "article_extraction_cache") {
          throw new Error(`Unexpected insert into ${name}`);
        }
        return {
          onConflictDoUpdate: ({ set }: { set: CapturedRow }) => {
            cacheWrites.push({ values, set });
            cache = {
              ...(cache ?? {}),
              ...values,
              ...set,
            } as FakeCacheRow;
            return promiseQuery([]);
          },
        };
      },
    }),
  };

  return db;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("article extraction workflow", () => {
  test("request path marks extraction pending and queues worker job", async () => {
    const db = createExtractionDb();
    const enqueued: CapturedRow[] = [];

    const result = await requestFullTextExtractionForUser(db as never, "user-1", "item-1", {
      enqueueExtractionJob: async (job) => {
        enqueued.push(job as unknown as CapturedRow);
        return "job-1";
      },
    });

    expect(result).toMatchObject({ ok: true, status: "queued" });
    expect(enqueued).toMatchObject([
      {
        type: "article.extract",
        payload: { articleId: "item-1", userId: "user-1" },
      },
    ]);
    expect(db.item).toMatchObject({
      extractedContentStatus: "pending",
      extractedContentError: null,
    });
    expect(db.item.extractedContentUpdatedAt).toBeInstanceOf(Date);
  });

  test("ready extraction cache persists article content without fetching", async () => {
    const db = createExtractionDb({
      cache: cacheRow({
        contentHtml: "<article><p>Cached performance article body.</p></article>",
        contentText: "Cached performance article body.",
      }),
    });
    const fetchMock = mock(async () => new Response("should not fetch"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await runArticleExtractionForUser(db as never, "user-1", "item-1");

    expect(result).toMatchObject({ ok: true, status: "ready" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.item).toMatchObject({
      extractedContentStatus: "ready",
      extractedContentHtml: "<article><p>Cached performance article body.</p></article>",
      extractedContentText: "Cached performance article body.",
      extractedContentError: null,
    });
  });

  test("fresh failed extraction cache persists failure without fetching", async () => {
    const db = createExtractionDb({
      cache: cacheRow({
        status: "failed",
        contentHash: null,
        contentHtml: null,
        contentText: null,
        errorCode: "TIMEOUT",
        errorMessage: "Full preview unavailable right now.",
      }),
    });
    const fetchMock = mock(async () => new Response("should not fetch"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await runArticleExtractionForUser(db as never, "user-1", "item-1");

    expect(result).toMatchObject({
      ok: false,
      status: "failed",
      errorCode: "TIMEOUT",
      errorMessage: "Full preview unavailable right now.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.item).toMatchObject({
      extractedContentStatus: "failed",
      extractedContentError: "Full preview unavailable right now.",
    });
  });

  test("stale failed extraction cache refetches and refreshes failed cache TTL", async () => {
    const staleFetchedAt = new Date(Date.now() - 7 * 60 * 60 * 1000);
    const db = createExtractionDb({
      cache: cacheRow({
        status: "failed",
        contentHash: null,
        contentHtml: null,
        contentText: null,
        errorCode: "TIMEOUT",
        errorMessage: "Old timeout.",
        fetchedAt: staleFetchedAt,
      }),
    });
    const fetchMock = mock(async () => new Response("upstream down", { status: 500 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await runArticleExtractionForUser(db as never, "user-1", "item-1");

    expect(result).toMatchObject({
      ok: false,
      status: "failed",
      errorCode: "FETCH_FAILED",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(db.cacheWrites).toHaveLength(1);
    expect(db.cache).toMatchObject({
      status: "failed",
      errorCode: "FETCH_FAILED",
      contentHtml: null,
      contentText: null,
    });
  });

  test("worker cache miss fetches, caches, and persists ready content", async () => {
    const html = await Bun.file(PERFORMANCE_DEV_LINEAR_FIXTURE).text();
    const db = createExtractionDb();
    const fetchMock = mock(async () => {
      return new Response(html, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await runArticleExtractionForUser(db as never, "user-1", "item-1");

    expect(result).toMatchObject({ ok: true, status: "ready" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(db.cacheWrites).toHaveLength(1);
    expect(db.cache).toMatchObject({
      status: "ready",
      sourceUrl: "https://93.184.216.34/how-is-linear-so-fast-a-technical-breakdown",
    });
    expect(db.item.extractedContentStatus).toBe("ready");
    expect(String(db.item.extractedContentText)).toContain("Linear feels immediate");
  });

  test("queue failure persists failed state instead of leaving pending poll active", async () => {
    const db = createExtractionDb();

    const result = await requestFullTextExtractionForUser(db as never, "user-1", "item-1", {
      enqueueExtractionJob: async () => {
        throw new Error("redis unavailable");
      },
    });

    expect(result).toMatchObject({
      ok: false,
      status: "failed",
      errorCode: "QUEUE_UNAVAILABLE",
    });
    expect(db.item).toMatchObject({
      extractedContentStatus: "failed",
      extractedContentError: "Full text extraction could not be queued.",
    });
  });

  test("cache table has the expected Drizzle table identity", () => {
    expect(tableName(articleExtractionCache)).toBe("article_extraction_cache");
    expect(tableName(feedItems)).toBe("feed_items");
  });
});
