import { describe, expect, test } from "bun:test";
import { articleExtractionCache, feedItems } from "@kyomi/db";
import {
  requestFullTextExtractionForUser,
  runArticleExtractionForUser,
} from "@modules/articles/reader/extraction/workflow";
import {
  cacheRow,
  clipRow,
  createExtractionDb,
  extractionServices,
  PERFORMANCE_DEV_LINEAR_FIXTURE,
  publishedJob,
  runExtraction,
  tableName,
} from "./workflow-harness";

const htmlResponse = (html: string) =>
  new Response(html, { status: 200, headers: { "content-type": "text/html" } });

describe("article extraction workflow", () => {
  test("request path marks extraction pending and queues worker job", async () => {
    const db = createExtractionDb();
    const xadds: unknown[][] = [];
    const services = extractionServices(db, {
      xadd: async (...args) => {
        xadds.push(args);
        return "1-0";
      },
    });

    const result = await runExtraction(
      requestFullTextExtractionForUser("user-1", "item-1"),
      services,
    );

    expect(result).toMatchObject({ ok: true, status: "queued" });
    expect(xadds.map(publishedJob)).toMatchObject([
      {
        type: "article.extract",
        payload: { articleId: "item-1", userId: "user-1", reason: "manual" },
      },
    ]);
    expect(db.item).toMatchObject({
      extractedContentStatus: "pending",
      extractedContentError: null,
    });
    expect(db.item.extractedContentUpdatedAt).toBeInstanceOf(Date);
  });

  test("request path does not queue a second job when another request already claimed the article", async () => {
    const db = createExtractionDb({ claimLost: true });
    const xadds: unknown[][] = [];
    const services = extractionServices(db, {
      xadd: async (...args) => {
        xadds.push(args);
        return "1-0";
      },
    });

    const result = await runExtraction(
      requestFullTextExtractionForUser("user-1", "item-1"),
      services,
    );

    expect(result).toMatchObject({ ok: true, status: "queued" });
    expect(xadds).toEqual([]);
    expect(db.item.extractedContentUpdatedAt).toBeNull();
  });

  test("request path returns ready immediately for fresh extraction cache hits", async () => {
    const db = createExtractionDb({
      cache: cacheRow({
        contentHtml: "<article><p>Cached request article body.</p></article>",
        contentText: "Cached request article body.",
      }),
    });
    const xadds: unknown[][] = [];
    const services = extractionServices(db, {
      xadd: async (...args) => {
        xadds.push(args);
        return "1-0";
      },
    });

    const result = await runExtraction(
      requestFullTextExtractionForUser("user-1", "item-1"),
      services,
    );

    expect(result).toMatchObject({ ok: true, status: "ready" });
    expect(xadds).toEqual([]);
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
    const services = extractionServices(db);

    const result = await runExtraction(runArticleExtractionForUser("user-1", "item-1"), services);

    expect(result).toMatchObject({ ok: true, status: "ready" });
    expect(services.requests).toEqual([]);
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
    const services = extractionServices(db);

    const result = await runExtraction(runArticleExtractionForUser("user-1", "item-1"), services);

    expect(result).toMatchObject({
      ok: false,
      status: "failed",
      errorCode: "TIMEOUT",
      errorMessage: "Full preview unavailable right now.",
    });
    expect(services.requests).toEqual([]);
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
    const services = extractionServices(db, {
      respond: () => new Response("upstream down", { status: 500 }),
    });

    const result = await runExtraction(runArticleExtractionForUser("user-1", "item-1"), services);

    expect(result).toMatchObject({
      ok: false,
      status: "failed",
      errorCode: "FETCH_FAILED",
      errorMessage: "Extraction failed (HTTP 500).",
    });
    expect(services.requests).toHaveLength(1);
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
    const services = extractionServices(db, { respond: () => htmlResponse(html) });

    const result = await runExtraction(runArticleExtractionForUser("user-1", "item-1"), services);

    expect(result).toMatchObject({ ok: true, status: "ready" });
    expect(services.requests).toHaveLength(1);
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
    const services = extractionServices(db, { respond: () => htmlResponse(html) });

    const result = await runExtraction(
      runArticleExtractionForUser("user-1", "clip-1", {
        titleReplacement: { replaceClipTitle: true, autogeneratedTitleAtQueue: "93.184.216.34" },
      }),
      services,
    );

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
    const services = extractionServices(db, { respond: () => htmlResponse(html) });

    const result = await runExtraction(
      runArticleExtractionForUser("user-1", "clip-1", {
        titleReplacement: { replaceClipTitle: false },
      }),
      services,
    );

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
    const services = extractionServices(db, { respond: () => htmlResponse(html) });

    const result = await runExtraction(
      runArticleExtractionForUser("user-1", "clip-1", {
        titleReplacement: { replaceClipTitle: true },
      }),
      services,
    );

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
    const services = extractionServices(db, { respond: () => htmlResponse(html) });

    const result = await runExtraction(
      runArticleExtractionForUser("user-1", "item-1", {
        hostRateLimiter: {
          run: async (url, task) => {
            limitedUrls.push(url);
            return task();
          },
        },
      }),
      services,
    );

    expect(result).toMatchObject({ ok: true, status: "ready" });
    expect(limitedUrls).toEqual([
      "https://93.184.216.34/how-is-linear-so-fast-a-technical-breakdown",
    ]);
    expect(services.requests).toHaveLength(1);
  });

  test("queue failure persists failed state instead of leaving pending poll active", async () => {
    const db = createExtractionDb();
    const services = extractionServices(db, {
      xadd: async () => {
        throw new Error("redis unavailable");
      },
    });

    const result = await runExtraction(
      requestFullTextExtractionForUser("user-1", "item-1"),
      services,
    );

    expect(result).toMatchObject({
      ok: false,
      status: "failed",
      errorCode: "QUEUE_UNAVAILABLE",
    });
    expect(db.item).toMatchObject({
      extractedContentStatus: "failed",
      extractedContentError: "Full text extraction could not be queued.",
    });
    expect(services.logs.entries).toContainEqual(
      expect.objectContaining({
        level: "error",
        event: "articles.extract_full_text.enqueue_failed",
        context: expect.objectContaining({ userId: "user-1", articleId: "item-1" }),
      }),
    );
  });

  test("cache table has the expected Drizzle table identity", () => {
    expect(tableName(articleExtractionCache)).toBe("article_extraction_cache");
    expect(tableName(feedItems)).toBe("feed_items");
  });
});
