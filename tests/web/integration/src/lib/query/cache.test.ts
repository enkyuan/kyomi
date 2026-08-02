import { describe, expect, test } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { InboxListPage } from "@modules/inbox/queries/options";
import type { ArticleDetailDto } from "@lib/schemas/index";
import { dropCorruptInboxItemQueries, prepareHotCacheState } from "@lib/query/cache";

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

describe("dropCorruptInboxItemQueries", () => {
  test("removes an item-detail entry whose cached data belongs to a different item id", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["inbox", "item-detail", "item-a"], articleDetail("item-b"));

    dropCorruptInboxItemQueries(queryClient);

    expect(
      queryClient.getQueryData(["inbox", "item-detail", "item-a"]),
    ).toBeUndefined();
  });

  test("removes an item-detail entry that fails schema validation", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["inbox", "item-detail", "item-a"], { not: "an article" });

    dropCorruptInboxItemQueries(queryClient);

    expect(
      queryClient.getQueryData(["inbox", "item-detail", "item-a"]),
    ).toBeUndefined();
  });

  test("retains a valid item-detail entry matching its own item id", () => {
    const queryClient = new QueryClient();
    const detail = articleDetail("item-a");
    queryClient.setQueryData(["inbox", "item-detail", "item-a"], detail);

    dropCorruptInboxItemQueries(queryClient);

    expect(queryClient.getQueryData(["inbox", "item-detail", "item-a"])).toEqual(detail);
  });
});
