import { afterEach, describe, expect, mock, test } from "bun:test";
import { articleExtractionCache, feedItems } from "@kyomi/db";
import {
  requestFullTextExtractionForUser,
  runArticleExtractionForUser,
} from "@modules/articles/reader/extraction/workflow";
import {
  cacheRow,
  clipRow,
  createExtractionDb,
  PERFORMANCE_DEV_LINEAR_FIXTURE,
  tableName,
} from "./workflow-harness";

const originalFetch = globalThis.fetch;

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

  test("request path returns ready immediately for fresh extraction cache hits", async () => {
    const db = createExtractionDb({
      cache: cacheRow({
        contentHtml: "<article><p>Cached request article body.</p></article>",
        contentText: "Cached request article body.",
      }),
    });
    const enqueued: CapturedRow[] = [];

    const result = await requestFullTextExtractionForUser(db as never, "user-1", "item-1", {
      enqueueExtractionJob: async (job) => {
        enqueued.push(job as unknown as CapturedRow);
        return "job-1";
      },
    });

    expect(result).toMatchObject({ ok: true, status: "ready" });
    expect(enqueued).toEqual([]);
    expect(db.item).toMatchObject({
      extractedContentStatus: "ready",
      extractedContentHtml: "<article><p>Cached request article body.</p></article>",
      extractedContentText: "Cached request article body.",
    });
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

  test("ready extraction replaces an autogenerated clip title left unedited since queueing", async () => {
    const html = await Bun.file(PERFORMANCE_DEV_LINEAR_FIXTURE).text();
    const db = createExtractionDb({ clip: clipRow({ title: "93.184.216.34" }) });
    globalThis.fetch = mock(
      async () =>
        new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
    ) as unknown as typeof fetch;

    const result = await runArticleExtractionForUser(db as never, "user-1", "clip-1", {
      titleReplacement: { replaceClipTitle: true, autogeneratedTitleAtQueue: "93.184.216.34" },
    });

    expect(result).toMatchObject({ ok: true, status: "ready" });
    const titleUpdate = db.updates.find(
      (entry) => entry.table === "article_clips" && Object.hasOwn(entry.patch, "title"),
    );
    expect(titleUpdate).toBeDefined();
    expect(titleUpdate?.patch.title).toBeTruthy();
    expect(titleUpdate?.patch.title).not.toBe("93.184.216.34");
  });

  test("ready extraction never attempts to replace a user-supplied clip title", async () => {
    const html = await Bun.file(PERFORMANCE_DEV_LINEAR_FIXTURE).text();
    const db = createExtractionDb({ clip: clipRow({ title: "My saved article" }) });
    globalThis.fetch = mock(
      async () =>
        new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
    ) as unknown as typeof fetch;

    const result = await runArticleExtractionForUser(db as never, "user-1", "clip-1", {
      titleReplacement: { replaceClipTitle: false },
    });

    expect(result).toMatchObject({ ok: true, status: "ready" });
    const titleUpdate = db.updates.find(
      (entry) => entry.table === "article_clips" && Object.hasOwn(entry.patch, "title"),
    );
    expect(titleUpdate).toBeUndefined();
    expect(db.clip?.title).toBe("My saved article");
  });

  test("ready extraction skips the title update when no autogenerated title was captured at queue time", async () => {
    const html = await Bun.file(PERFORMANCE_DEV_LINEAR_FIXTURE).text();
    const db = createExtractionDb({ clip: clipRow({ title: "93.184.216.34" }) });
    globalThis.fetch = mock(
      async () =>
        new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
    ) as unknown as typeof fetch;

    const result = await runArticleExtractionForUser(db as never, "user-1", "clip-1", {
      titleReplacement: { replaceClipTitle: true },
    });

    expect(result).toMatchObject({ ok: true, status: "ready" });
    const titleUpdate = db.updates.find(
      (entry) => entry.table === "article_clips" && Object.hasOwn(entry.patch, "title"),
    );
    expect(titleUpdate).toBeUndefined();
  });

  test("worker source fetch runs through the provided host limiter", async () => {
    const html = await Bun.file(PERFORMANCE_DEV_LINEAR_FIXTURE).text();
    const db = createExtractionDb();
    const limitedUrls: string[] = [];
    const fetchMock = mock(async () => {
      return new Response(html, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await runArticleExtractionForUser(db as never, "user-1", "item-1", {
      hostRateLimiter: {
        run: async (url, task) => {
          limitedUrls.push(url);
          return task();
        },
      },
    });

    expect(result).toMatchObject({ ok: true, status: "ready" });
    expect(limitedUrls).toEqual([
      "https://93.184.216.34/how-is-linear-so-fast-a-technical-breakdown",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
