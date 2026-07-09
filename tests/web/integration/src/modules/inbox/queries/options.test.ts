import { describe, expect, test } from "vitest";
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

  test("hot prefetch requests only the active inbox list and sidebar summary", async () => {
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
});
