// @vitest-environment jsdom

import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";
import type { InboxListPage } from "@modules/articles/lib/api";
import type { ArticleDetailDto } from "@kyomi/reader/schemas";
import { dropCorruptHotQueries, prepareHotCacheState } from "@lib/query/cache";

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
    lastViewedAt: null,
    readingProgress: null,
    readingPosition: null,
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
  test("bounds inbox lists and item details without retaining extra list pages", () => {
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
        ...Array.from({ length: 22 }, (_, index) =>
          successfulQuery(
            ["inbox", "item-detail", `item-${index}`],
            { id: `item-${index}` },
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
    expect(compacted.queries.filter((query) => query.queryKey[1] === "item-detail")).toHaveLength(
      20,
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
  const detailKey = (id: string) => ["inbox", "item-detail", id] as const;
  const keysAfter = (...queries: DehydratedHotQuery[]) =>
    dropCorruptHotQueries({ mutations: [], queries }).queries.map((query) => query.queryKey);

  test("retains an item-detail entry holding the article it is keyed by, in its { item } wrapper", () => {
    const entry = successfulQuery(detailKey("item-a"), { item: articleDetail("item-a") }, 1);

    expect(keysAfter(entry)).toEqual([detailKey("item-a")]);
  });

  test("retains an entry whose article is gone ({ item: null }) and one with no data yet", () => {
    const gone = successfulQuery(detailKey("item-a"), { item: null }, 1);
    const pending: DehydratedHotQuery = {
      ...successfulQuery(detailKey("item-b"), undefined, 0),
      state: {
        ...successfulQuery(detailKey("item-b"), undefined, 0).state,
        status: "pending",
        fetchStatus: "fetching",
      },
    };

    expect(keysAfter(gone, pending)).toEqual([detailKey("item-a"), detailKey("item-b")]);
  });

  test("removes an item-detail entry whose article belongs to a different item id", () => {
    const entry = successfulQuery(detailKey("item-a"), { item: articleDetail("item-b") }, 1);

    expect(keysAfter(entry)).toEqual([]);
  });

  test("removes an item-detail entry that fails schema validation or lacks the wrapper", () => {
    const invalid = successfulQuery(detailKey("item-a"), { item: { not: "an article" } }, 1);
    const unwrapped = successfulQuery(detailKey("item-b"), articleDetail("item-b"), 1);

    expect(keysAfter(invalid, unwrapped)).toEqual([]);
  });

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

/** The few IndexedDB calls the hot cache makes, over one stored snapshot. */
function stubIndexedDb(snapshot: unknown) {
  const store = new Map<string, unknown>([["kyomi:hot-query-cache:v2", snapshot]]);
  const database = {
    createObjectStore: () => undefined,
    close: () => undefined,
    transaction: () => {
      const transaction: { oncomplete?: () => void; objectStore: () => unknown } = {
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
            store.set(key, value);
            queueMicrotask(() => transaction.oncomplete?.());
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
        setTimeout(() => {
          request.onupgradeneeded?.();
          request.onsuccess?.();
        });
        return request;
      },
    },
  });
}

describe("hydrateHotQueryCache", () => {
  test("restores the snapshot without touching the queries the page already holds", async () => {
    vi.resetModules();
    const { hydrateHotQueryCache } = await import("@lib/query/cache");
    stubIndexedDb({
      savedAt: Date.now(),
      state: {
        mutations: [],
        queries: [
          successfulQuery(["inbox", "item-detail", "item-a"], { item: articleDetail("item-a") }, 1),
          successfulQuery(["inbox", "item-detail", "item-bad"], articleDetail("item-bad"), 1),
        ],
      },
    });
    const queryClient = new QueryClient();
    const live = { item: articleDetail("item-live") };
    queryClient.setQueryData(["inbox", "item-detail", "item-live"], live);

    await hydrateHotQueryCache(queryClient);

    // The page's own query survives, the valid snapshot entry is restored, the malformed one is not.
    expect(queryClient.getQueryData(["inbox", "item-detail", "item-live"])).toEqual(live);
    expect(queryClient.getQueryData(["inbox", "item-detail", "item-a"])).toEqual({
      item: articleDetail("item-a"),
    });
    expect(queryClient.getQueryData(["inbox", "item-detail", "item-bad"])).toBeUndefined();
  });
});
