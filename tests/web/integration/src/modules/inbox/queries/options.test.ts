import { describe, expect, test } from "vitest";
import {
  getInboxSwitchTargetScopes,
  hasActiveFeedRefresh,
  inboxDetailQueryOptions,
  prefetchInboxHotQueries,
  prefetchInboxItemDetail,
  prefetchInboxSwitchTargets,
} from "@modules/inbox/queries/options";

describe("active feed refresh status", () => {
  test("treats queued and running feeds as active", () => {
    expect(hasActiveFeedRefresh([{ refreshStatus: "queued" }])).toBe(true);
    expect(hasActiveFeedRefresh([{ refreshStatus: "running" }])).toBe(true);
  });

  test("does not treat terminal or missing statuses as active", () => {
    expect(
      hasActiveFeedRefresh([
        { refreshStatus: "idle" },
        { refreshStatus: "failed" },
        { refreshStatus: null },
        {},
      ]),
    ).toBe(false);
    expect(hasActiveFeedRefresh(undefined)).toBe(false);
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

    await prefetchInboxItemDetail(queryClient as never, "item-1");

    expect(prefetchQueryCalls).toHaveLength(1);
    expect((prefetchQueryCalls[0] as { queryKey: readonly unknown[] }).queryKey).toEqual([
      "inbox",
      "item-detail",
      "item-1",
    ]);
  });

  test("polls detail only for a requested pending extraction", () => {
    const options = inboxDetailQueryOptions("item-1");
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

describe("inbox switch target prefetch", () => {
  test("hot prefetch blocks only on the active list and sidebar summary", async () => {
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

    await prefetchInboxHotQueries(queryClient as never, {
      filter: "all",
      timezoneOffsetMinutes: 300,
    });

    expect(
      prefetchInfiniteQueryCalls.map(
        (options) => (options as { queryKey: readonly unknown[] }).queryKey,
      ),
    ).toEqual([
      ["inbox", "items", 4, "all", undefined, undefined, undefined, undefined, "newest", 300],
    ]);
    expect(
      prefetchQueryCalls.map((options) => (options as { queryKey: readonly unknown[] }).queryKey),
    ).toEqual([["sidebar", "inbox-summary", "global", 300]]);
  });

  test("includes the active scope, filter tabs, followed feeds, and folders once", () => {
    expect(
      getInboxSwitchTargetScopes({
        filter: "my-feed",
        timezoneOffsetMinutes: 300,
        feeds: [{ feedId: "feed-1" }, { feedId: " feed-2 " }, { feedId: "feed-1" }],
        folders: [{ id: "folder-1" }, { id: "folder-1" }, { id: "" }],
      }),
    ).toEqual([
      { filter: "my-feed", sort: "newest", timezoneOffsetMinutes: 300 },
      { filter: "all", sort: "newest", timezoneOffsetMinutes: 300 },
      { filter: "saved", sort: "newest", timezoneOffsetMinutes: 300 },
      { filter: "recent", sort: "newest", timezoneOffsetMinutes: 300 },
      {
        filter: "all",
        feedId: "feed-1",
        sort: "newest",
        timezoneOffsetMinutes: 300,
      },
      {
        filter: "all",
        feedId: "feed-2",
        sort: "newest",
        timezoneOffsetMinutes: 300,
      },
      {
        filter: "all",
        folderId: "folder-1",
        sort: "newest",
        timezoneOffsetMinutes: 300,
      },
    ]);
  });

  test("prefetches inbox item queries for every switch target", async () => {
    const prefetchInfiniteQueryCalls: unknown[] = [];
    const queryClient = {
      prefetchInfiniteQuery: async (options: unknown) => {
        prefetchInfiniteQueryCalls.push(options);
      },
    };

    await prefetchInboxSwitchTargets(queryClient as never, {
      filter: "all",
      feedId: "feed-1",
      timezoneOffsetMinutes: 300,
      feeds: [{ feedId: "feed-1" }],
      folders: [{ id: "folder-1" }],
    });

    expect(
      prefetchInfiniteQueryCalls.map(
        (options) => (options as { queryKey: readonly unknown[] }).queryKey,
      ),
    ).toEqual([
      ["inbox", "items", 4, "all", undefined, "feed-1", undefined, undefined, "newest", 300],
      ["inbox", "items", 4, "my-feed", undefined, undefined, undefined, undefined, "newest", 300],
      ["inbox", "items", 4, "all", undefined, undefined, undefined, undefined, "newest", 300],
      ["inbox", "items", 4, "saved", undefined, undefined, undefined, undefined, "newest", 300],
      ["inbox", "items", 4, "recent", undefined, undefined, undefined, undefined, "newest", 300],
      ["inbox", "items", 4, "all", undefined, undefined, "folder-1", undefined, "newest", 300],
    ]);
  });
});
