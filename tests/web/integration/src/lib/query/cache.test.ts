import { describe, expect, test } from "vitest";
import type { InboxListPage } from "@modules/inbox/queries/options";
import { prepareHotCacheState } from "@lib/query/cache";

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
