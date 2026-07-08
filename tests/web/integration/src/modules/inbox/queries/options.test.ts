import { describe, expect, test } from "vitest";
import {
  InfiniteQueryObserver,
  QueryClient,
} from "../../../../../../../apps/web/node_modules/@tanstack/react-query";
import * as inboxQueryOptions from "@modules/inbox/queries/options";

describe("active feed refresh status", () => {
  test("treats queued and running feeds as active", () => {
    expect(inboxQueryOptions.hasActiveFeedRefresh([{ refreshStatus: "queued" }])).toBe(true);
    expect(inboxQueryOptions.hasActiveFeedRefresh([{ refreshStatus: "running" }])).toBe(true);
  });

  test("does not treat terminal or missing statuses as active", () => {
    expect(
      inboxQueryOptions.hasActiveFeedRefresh([
        { refreshStatus: "idle" },
        { refreshStatus: "failed" },
        { refreshStatus: null },
        {},
      ]),
    ).toBe(false);
    expect(inboxQueryOptions.hasActiveFeedRefresh(undefined)).toBe(false);
  });
});

describe("inbox detail prefetch", () => {
  test("prefetches the item detail query for a known article id", async () => {
    const prefetchQueryCalls: unknown[] = [];
    const queryClient = {
      prefetchQuery: async (options: unknown) => {
        prefetchQueryCalls.push(options);
      },
    };

    await inboxQueryOptions.prefetchInboxItemDetail(queryClient as never, "item-1");

    expect(prefetchQueryCalls).toHaveLength(1);
    expect((prefetchQueryCalls[0] as { queryKey: readonly unknown[] }).queryKey).toEqual([
      "inbox",
      "item-detail",
      "item-1",
    ]);
  });

  test("polls detail only for a requested pending extraction", () => {
    const options = inboxQueryOptions.inboxDetailQueryOptions("item-1");
    const refetchInterval = options.refetchInterval;

    expect(
      refetchInterval({
        state: {
          data: {
            item: {
              reader: {
                extracted: { status: "pending", updatedAt: "2026-07-08T00:00:00.000Z" },
              },
            },
          },
        },
      } as never),
    ).toBe(2_500);

    expect(
      refetchInterval({
        state: {
          data: {
            item: {
              reader: {
                extracted: { status: "pending", updatedAt: null },
              },
            },
          },
        },
      } as never),
    ).toBe(false);
  });
});

describe("feed refresh polling policy", () => {
  test("uses the active cadence only while a refresh is queued or running", () => {
    expect(inboxQueryOptions.getFeedRefreshPollInterval([{ refreshStatus: "idle" }])).toBe(30_000);
    expect(inboxQueryOptions.getFeedRefreshPollInterval([{ refreshStatus: "queued" }])).toBe(2_500);
    expect(inboxQueryOptions.getFeedRefreshPollInterval([{ refreshStatus: "running" }])).toBe(
      2_500,
    );
  });
});

describe("inbox detail prefetch", () => {
  test("prefetches the item detail query for a known article id", async () => {
    const prefetchQueryCalls: unknown[] = [];
    const queryClient = {
      prefetchQuery: async (options: unknown) => {
        prefetchQueryCalls.push(options);
      },
    };

    await inboxQueryOptions.prefetchInboxItemDetail(queryClient as never, "item-1");

    expect(prefetchQueryCalls).toHaveLength(1);
    expect((prefetchQueryCalls[0] as { queryKey: readonly unknown[] }).queryKey).toEqual([
      "inbox",
      "item-detail",
      "item-1",
    ]);
  });

  test("polls detail only for a requested pending extraction", () => {
    const options = inboxQueryOptions.inboxDetailQueryOptions("item-1");
    const refetchInterval = options.refetchInterval;

    expect(
      refetchInterval({
        state: {
          data: {
            item: {
              reader: {
                extracted: { status: "pending", updatedAt: "2026-07-08T00:00:00.000Z" },
              },
            },
          },
        },
      } as never),
    ).toBe(2_500);

    expect(
      refetchInterval({
        state: {
          data: {
            item: {
              reader: {
                extracted: { status: "pending", updatedAt: null },
              },
            },
          },
        },
      } as never),
    ).toBe(false);
  });
});

describe("inbox prefetch", () => {
  test("does not export bulk switch-target prefetch", () => {
    expect(inboxQueryOptions).not.toHaveProperty("prefetchInboxSwitchTargets");
    expect(inboxQueryOptions).not.toHaveProperty("getInboxSwitchTargetScopes");
  });

  test("never shows previous-filter rows while a cold target loads", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const neverSettles = new Promise<never>(() => {});
    const page = (item: string) => ({
      pages: [{ items: [item], total: 1, nextCursor: null, hasMore: false }],
      pageParams: [undefined],
    });
    const myFeedOptions = {
      ...inboxQueryOptions.inboxItemsInfiniteQueryOptions({
        filter: "my-feed",
        timezoneOffsetMinutes: 300,
      }),
      queryFn: () => neverSettles,
    };
    const allOptions = {
      ...inboxQueryOptions.inboxItemsInfiniteQueryOptions({
        filter: "all",
        timezoneOffsetMinutes: 300,
      }),
      queryFn: () => neverSettles,
    };

    queryClient.setQueryData(myFeedOptions.queryKey, page("my-feed-item"));
    const observer = new InfiniteQueryObserver(queryClient, myFeedOptions);
    const unsubscribe = observer.subscribe(() => {});

    try {
      observer.setOptions(allOptions);
      const coldResult = observer.getCurrentResult();
      expect(coldResult.data).toBeUndefined();
      expect(coldResult.isPlaceholderData).toBe(false);

      queryClient.setQueryData(allOptions.queryKey, page("all-item"));
      const warmResult = observer.getCurrentResult();
      expect(warmResult.data?.pages[0]?.items).toEqual(["all-item"]);
      expect(warmResult.isPlaceholderData).toBe(false);
    } finally {
      unsubscribe();
      queryClient.clear();
    }
  });

  test("uses one cache key for omitted and explicit false read scopes", () => {
    const implicitFalse = inboxQueryOptions.inboxItemsInfiniteQueryOptions({
      filter: "all",
      timezoneOffsetMinutes: 300,
    });
    const explicitFalse = inboxQueryOptions.inboxItemsInfiniteQueryOptions({
      filter: "all",
      includeRead: false,
      timezoneOffsetMinutes: 300,
    });

    expect(implicitFalse.queryKey).toEqual(explicitFalse.queryKey);
  });

  test("prefetches only the sibling segmented-control filter", async () => {
    const prefetchInfiniteQueryCalls: unknown[] = [];
    const queryClient = {
      prefetchInfiniteQuery: async (options: unknown) => {
        prefetchInfiniteQueryCalls.push(options);
      },
    };

    await inboxQueryOptions.prefetchInboxSegmentedControlTarget(queryClient as never, {
      filter: "my-feed",
      search: "reader",
      includeRead: true,
      sort: "oldest",
      timezoneOffsetMinutes: 300,
    });

    expect(
      prefetchInfiniteQueryCalls.map(
        (options) => (options as { queryKey: readonly unknown[] }).queryKey,
      ),
    ).toEqual([["inbox", "items", 4, "all", "reader", undefined, undefined, true, "oldest", 300]]);
  });

  test("feed-scoped hot prefetch stays limited to the active list and sidebar summary", async () => {
    const prefetchInfiniteQueryCalls: unknown[] = [];
    const prefetchQueryCalls: unknown[] = [];
    const queryClient = {
      prefetchInfiniteQuery: async (options: unknown) => {
        prefetchInfiniteQueryCalls.push(options);
      },
      prefetchQuery: async (options: unknown) => {
        prefetchQueryCalls.push(options);
      },
    };

    await inboxQueryOptions.prefetchInboxHotQueries(queryClient as never, {
      filter: "all",
      feedId: "feed-1",
      timezoneOffsetMinutes: 300,
    });

    expect(prefetchInfiniteQueryCalls).toHaveLength(1);
    expect(prefetchQueryCalls).toHaveLength(1);
  });

  test("hot prefetch warms the sibling global tab without restoring feed or folder fan-out", async () => {
    const prefetchInfiniteQueryCalls: unknown[] = [];
    const prefetchQueryCalls: unknown[] = [];
    const queryClient = {
      prefetchInfiniteQuery: async (options: unknown) => {
        prefetchInfiniteQueryCalls.push(options);
      },
      prefetchQuery: async (options: unknown) => {
        prefetchQueryCalls.push(options);
      },
    };

    await inboxQueryOptions.prefetchInboxHotQueries(queryClient as never, {
      filter: "my-feed",
      timezoneOffsetMinutes: 300,
    });

    expect(
      prefetchInfiniteQueryCalls.map(
        (options) => (options as { queryKey: readonly unknown[] }).queryKey,
      ),
    ).toEqual([
      ["inbox", "items", 4, "all", undefined, undefined, undefined, false, "newest", 300],
      ["inbox", "items", 4, "my-feed", undefined, undefined, undefined, false, "newest", 300],
    ]);
    expect(prefetchQueryCalls).toHaveLength(1);
  });
});
