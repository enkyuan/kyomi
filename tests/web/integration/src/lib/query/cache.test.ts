// @vitest-environment jsdom

import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { InboxListPage } from "@modules/articles/lib/api";
import { dropCorruptHotQueries, prepareHotCacheState } from "@lib/query/cache";

const HOT_CACHE_KEY = "kyomi:hot-query-cache:v2";
const HOT_CACHE_SCHEMA = 3;

type HotCacheState = Parameters<typeof prepareHotCacheState>[0];
type DehydratedHotQuery = HotCacheState["queries"][number];
type InfiniteInboxData = {
  pages: InboxListPage[];
  pageParams: unknown[];
};

function inboxPage(id: string): InboxListPage {
  return {
    items: [],
    total: 0,
    nextCursor: id,
    hasMore: false,
  };
}

function infiniteInboxData(...pages: InboxListPage[]): InfiniteInboxData {
  return {
    pages,
    pageParams: pages.map((page) => `${page.nextCursor}-page-param`),
  };
}

function fallbackReaderContent() {
  return {
    contentStatus: "failed" as const,
    contentSource: "link_only" as const,
    bodyKind: "fallback" as const,
    contentBaseUrl: null,
    title: null,
    byline: null,
    excerpt: null,
    siteName: null,
    language: null,
    publishedTime: null,
    notice: null,
    extractionErrorCode: null,
    extractionErrorMessage: null,
    shouldExtract: false,
    contentHtml: null,
    contentMarkdown: null,
    contentText: null,
    fallbackSummary: null,
    fallbackReason: "missing_content" as const,
  };
}

function articleDetail(id: string): ArticleDetailDto {
  return {
    id,
    title: `Title for ${id}`,
    link: `https://example.com/${id}`,
    summary: null,
    publishedAt: new Date(0).toISOString(),
    feedId: "feed-1",
    feedUrl: null,
    feedSiteUrl: null,
    feedTitle: "Feed",
    feedFaviconUrl: null,
    isRead: false,
    isSaved: false,
    articleType: "feed",
    categories: [],
    contentHtml: null,
    contentText: null,
    contentMarkdown: null,
    contentStatus: "pending",
    contentSource: "link_only",
    extractionErrorCode: null,
    extractionErrorMessage: null,
    reader: {
      activeMode: "original",
      selected: fallbackReaderContent(),
      original: { available: true, content: fallbackReaderContent() },
      extracted: {
        available: false,
        content: null,
        status: "pending",
        error: null,
        updatedAt: null,
      },
    },
  };
}

function successfulQuery(
  queryKey: readonly unknown[],
  data: unknown,
  dataUpdatedAt: number,
): DehydratedHotQuery {
  return {
    queryHash: JSON.stringify(queryKey),
    queryKey,
    state: {
      data,
      dataUpdatedAt,
      dataUpdateCount: 1,
      error: null,
      errorUpdateCount: 0,
      errorUpdatedAt: 0,
      fetchFailureCount: 0,
      fetchFailureReason: null,
      fetchMeta: null,
      fetchStatus: "idle",
      isInvalidated: false,
      status: "success",
    },
  };
}

describe("prepareHotCacheState", () => {
  test("bounds inbox lists without retaining extra list pages", () => {
    const state: HotCacheState = {
      mutations: [],
      queries: [
        ...Array.from({ length: 10 }, (_, index) =>
          successfulQuery(
            ["inbox", "items", `scope-${index}`],
            infiniteInboxData(
              inboxPage(`scope-${index}-page-0`),
              inboxPage(`scope-${index}-page-1`),
            ),
            index,
          ),
        ),
      ],
    };

    const compacted = prepareHotCacheState(state);
    const listQueries = compacted.queries.filter((query) => query.queryKey[1] === "items");
    const retainedScopes = Array.from({ length: 8 }, (_, index) => 9 - index);

    expect(listQueries).toHaveLength(8);
    expect(
      listQueries.map((query) => ({
        scope: query.queryKey[2],
        dataUpdatedAt: query.state.dataUpdatedAt,
      })),
    ).toEqual(
      retainedScopes.map((scope) => ({
        scope: `scope-${scope}`,
        dataUpdatedAt: scope,
      })),
    );
    expect(
      listQueries.map((query) => {
        const data = query.state.data as InfiniteInboxData;
        return [data.pages.length, data.pageParams.length];
      }),
    ).toEqual(retainedScopes.map(() => [1, 1]));
    expect(
      listQueries.map((query) => {
        const data = query.state.data as InfiniteInboxData;
        return {
          page: data.pages[0]?.nextCursor,
          pageParam: data.pageParams[0],
        };
      }),
    ).toEqual(
      retainedScopes.map((scope) => ({
        page: `scope-${scope}-page-0`,
        pageParam: `scope-${scope}-page-0-page-param`,
      })),
    );
  });

  test("retains page zero and excludes invalid inbox list data", () => {
    const firstPage = inboxPage("initial-cursor");
    const state: HotCacheState = {
      mutations: [],
      queries: [
        successfulQuery(
          ["inbox", "items", "valid"],
          {
            pages: [firstPage, { invalid: true }],
            pageParams: ["initial-page-param", "later-page-param"],
          },
          1,
        ),
        successfulQuery(
          ["inbox", "items", "invalid"],
          { pages: [{ invalid: true }], pageParams: ["invalid-cursor"] },
          2,
        ),
      ],
    };

    const compacted = prepareHotCacheState(state);
    const listQueries = compacted.queries.filter((query) => query.queryKey[1] === "items");

    expect(listQueries).toHaveLength(1);
    expect(listQueries[0]?.queryKey).toEqual(["inbox", "items", "valid"]);
    expect((listQueries[0]?.state.data as InfiniteInboxData).pages).toEqual([firstPage]);
    expect((listQueries[0]?.state.data as InfiniteInboxData).pageParams).toEqual([
      "initial-page-param",
    ]);
  });
});

describe("dropCorruptHotQueries", () => {
  const keysAfter = (...queries: DehydratedHotQuery[]) =>
    dropCorruptHotQueries({ mutations: [], queries }).queries.map((query) => query.queryKey);

  test("removes a list whose data is null or malformed without losing the valid ones", () => {
    const valid = successfulQuery(["inbox", "items", "ok"], infiniteInboxData(inboxPage("a")), 1);
    const nothing = successfulQuery(["inbox", "items", "null"], null, 1);
    const notPages = successfulQuery(
      ["inbox", "items", "text"],
      { pages: "abc", pageParams: [] },
      1,
    );

    expect(keysAfter(valid, nothing, notPages)).toEqual([["inbox", "items", "ok"]]);
  });

  test("removes an inbox list with an invalid page and keeps a valid one and other queries", () => {
    const valid = successfulQuery(["inbox", "items", "ok"], infiniteInboxData(inboxPage("a")), 1);
    const invalid = successfulQuery(
      ["inbox", "items", "bad"],
      { pages: [{ invalid: true }], pageParams: ["cursor"] },
      1,
    );
    const other = successfulQuery(["folders", "all"], [], 1);

    expect(keysAfter(valid, invalid, other)).toEqual([
      ["inbox", "items", "ok"],
      ["folders", "all"],
    ]);
  });
});

/** The few IndexedDB calls the hot cache makes, over one in-memory store. */
function stubIndexedDb(
  initial: Record<string, unknown> = {},
  options: { failWrites?: () => boolean } = {},
) {
  const store = new Map<string, unknown>(Object.entries(initial));
  const writes: unknown[] = [];
  const database = {
    createObjectStore: () => undefined,
    close: () => undefined,
    transaction: () => {
      const transaction: {
        oncomplete?: () => void;
        onabort?: () => void;
        error?: unknown;
        objectStore: () => unknown;
      } = {
        objectStore: () => ({
          get: (key: string) => {
            const request: { result?: unknown; onsuccess?: () => void } = {};
            queueMicrotask(() => {
              request.result = store.get(key);
              request.onsuccess?.();
              transaction.oncomplete?.();
            });
            return request;
          },
          put: (value: unknown, key: string) => {
            queueMicrotask(() => {
              if (options.failWrites?.()) {
                transaction.error = new DOMException("full", "QuotaExceededError");
                transaction.onabort?.();
                return;
              }
              store.set(key, value);
              writes.push(value);
              transaction.oncomplete?.();
            });
          },
          delete: (key: string) => {
            store.delete(key);
            queueMicrotask(() => transaction.oncomplete?.());
          },
        }),
      };
      return transaction;
    },
  };
  Object.defineProperty(window, "indexedDB", {
    configurable: true,
    value: {
      open: () => {
        const request: { result: unknown; onupgradeneeded?: () => void; onsuccess?: () => void } = {
          result: database,
        };
        queueMicrotask(() => {
          request.onupgradeneeded?.();
          request.onsuccess?.();
        });
        return request;
      },
    },
  });
  return { store, writes };
}

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    savedAt: Date.now(),
    schema: HOT_CACHE_SCHEMA,
    userId: "user-1",
    state: {
      mutations: [],
      queries: [successfulQuery(["folders", "all"], [{ id: "folder-1" }], 1)],
    },
    ...overrides,
  };
}

describe("hydrateHotQueryCache", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  async function load() {
    vi.resetModules();
    return import("@lib/query/cache");
  }

  test("restores the snapshot without touching the queries the page already holds", async () => {
    const { hydrateHotQueryCache } = await load();
    stubIndexedDb({
      [HOT_CACHE_KEY]: snapshot({
        state: {
          mutations: [],
          queries: [
            successfulQuery(["folders", "all"], [{ id: "folder-1" }], 1),
            successfulQuery(["inbox", "items", "bad"], { pages: [{ invalid: true }] }, 1),
          ],
        },
      }),
    });
    const queryClient = new QueryClient();
    queryClient.setQueryData(["feeds", "followed"], ["live"]);

    await hydrateHotQueryCache(queryClient, "user-1");

    expect(queryClient.getQueryData(["feeds", "followed"])).toEqual(["live"]);
    expect(queryClient.getQueryData(["folders", "all"])).toEqual([{ id: "folder-1" }]);
    expect(queryClient.getQueryData(["inbox", "items", "bad"])).toBeUndefined();
  });

  test.each([
    ["another user", { userId: "user-2" }],
    ["an older schema", { schema: HOT_CACHE_SCHEMA - 1 }],
    ["no schema (a snapshot from before versioning)", { schema: undefined, userId: undefined }],
    ["more than a day ago", { savedAt: Date.now() - 25 * 60 * 60_000 }],
  ])("discards a snapshot from %s unread and deletes it", async (_name, overrides) => {
    const { hydrateHotQueryCache } = await load();
    const { store } = stubIndexedDb({ [HOT_CACHE_KEY]: snapshot(overrides) });
    const queryClient = new QueryClient();

    await hydrateHotQueryCache(queryClient, "user-1");

    expect(queryClient.getQueryData(["folders", "all"])).toBeUndefined();
    expect(store.has(HOT_CACHE_KEY)).toBe(false);
  });
});

describe("hot cache persistence", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  async function setup(options?: Parameters<typeof stubIndexedDb>[1]) {
    vi.resetModules();
    vi.useFakeTimers();
    const cache = await import("@lib/query/cache");
    const db = stubIndexedDb({}, options);
    const queryClient = new QueryClient();
    const unsubscribe = cache.subscribeHotQueryCachePersistence(queryClient, "user-1");
    const flush = () => vi.advanceTimersByTimeAsync(1_500);
    return { ...cache, ...db, queryClient, unsubscribe, flush };
  }

  test("saves only the hot queries, stamped with the user and schema version", async () => {
    const { writes, queryClient, flush, unsubscribe } = await setup();

    queryClient.setQueryData(["folders", "all"], [{ id: "folder-1" }]);
    queryClient.setQueryData(["inbox", "item-detail", "item-a"], { item: { id: "item-a" } });
    queryClient.setQueryData(["unrelated"], "x");
    await flush();

    expect(writes).toHaveLength(1);
    const saved = writes[0] as ReturnType<typeof snapshot>;
    expect(saved.userId).toBe("user-1");
    expect(saved.schema).toBe(HOT_CACHE_SCHEMA);
    expect(saved.state.queries.map((query) => query.queryKey)).toEqual([["folders", "all"]]);
    unsubscribe();
  });

  test("only data arriving or a query leaving schedules a write, not observers or fetches", async () => {
    const { queryClient, flush, unsubscribe } = await setup();

    queryClient.setQueryData(["folders", "all"], [{ id: "folder-1" }]);
    await flush();
    const cache = queryClient.getQueryCache();
    const query = cache.find({ queryKey: ["folders", "all"] })!;
    // The query's own garbage-collection timer is already pending; a write adds one more.
    const baseline = vi.getTimerCount();

    cache.notify({ type: "observerResultsUpdated", query });
    cache.notify({ type: "observerAdded", query, observer: {} as never });
    cache.notify({ type: "updated", query, action: { type: "fetch" } });
    expect(vi.getTimerCount()).toBe(baseline);

    cache.notify({
      type: "updated",
      query,
      action: { type: "success", data: [], dataUpdatedAt: 1 } as never,
    });
    expect(vi.getTimerCount()).toBe(baseline + 1);
    unsubscribe();
  });

  test("does not rewrite a snapshot that has not changed", async () => {
    const { writes, queryClient, flush, unsubscribe } = await setup();

    queryClient.setQueryData(["folders", "all"], [{ id: "folder-1" }]);
    await flush();
    // A hot query that never succeeded leaves the cache: an event, but nothing in the snapshot.
    const cache = queryClient.getQueryCache();
    cache.build(queryClient, { queryKey: ["feeds", "followed", "pending"] });
    cache.remove(cache.find({ queryKey: ["feeds", "followed", "pending"] })!);
    await flush();
    unsubscribe();

    expect(writes).toHaveLength(1);
  });

  test("keeps the last good snapshot when a write fails, and stops after a full store", async () => {
    let failing = false;
    const { writes, store, queryClient, flush, unsubscribe } = await setup({
      failWrites: () => failing,
    });

    queryClient.setQueryData(["folders", "all"], [{ id: "folder-1" }]);
    await flush();
    expect(writes).toHaveLength(1);

    failing = true;
    queryClient.setQueryData(["folders", "all"], [{ id: "folder-2" }]);
    await flush();
    failing = false;
    // A quota error disables persisting: the later change is not attempted.
    queryClient.setQueryData(["folders", "all"], [{ id: "folder-3" }]);
    await flush();
    unsubscribe();

    expect(writes).toHaveLength(1);
    expect((store.get(HOT_CACHE_KEY) as ReturnType<typeof snapshot>).state.queries).toHaveLength(1);
  });

  test("clearing does not wait on a write that never settles", async () => {
    const { clearHotQueryCache } = await setup();
    const cleared = clearHotQueryCache();

    await vi.advanceTimersByTimeAsync(2_500);
    await expect(cleared).resolves.toBeUndefined();
  });
});
