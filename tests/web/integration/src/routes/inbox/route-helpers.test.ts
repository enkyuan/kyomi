import { describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getInboxLoaderData: vi.fn(),
  prefetchInboxHotQueries: vi.fn(),
}));

vi.mock("@modules/feeds/lib/api", () => ({
  listFollowedFeeds: () => [],
}));

vi.mock("@modules/folders/lib/api", () => ({
  listFolders: () => [],
}));

vi.mock("@modules/inbox/lib/route", () => ({
  getInboxLoaderData: mocks.getInboxLoaderData,
}));

vi.mock("@modules/inbox/queries/options", () => ({
  followedFeedsQueryKey: () => ["feeds", "followed"],
  prefetchInboxHotQueries: mocks.prefetchInboxHotQueries,
  prefetchInboxItemDetail: () => undefined,
}));

describe("loadInboxRoute", () => {
  test("does not block route hydration on inbox prefetches", async () => {
    const neverSettles = new Promise<never>(() => {});
    mocks.getInboxLoaderData.mockResolvedValue({
      initialInboxPreferences: { inboxDefaultView: "my-feed" },
      initialTimezoneOffsetMinutes: 300,
    });
    mocks.prefetchInboxHotQueries.mockReturnValue(neverSettles);
    const queryClient = {
      prefetchQuery: vi.fn(() => neverSettles),
    };
    const { loadInboxRoute } = await import("src/routes/_app/inbox/-route-helpers");

    const loaderPromise = loadInboxRoute({
      context: { queryClient: queryClient as never },
      deps: { filter: "all" },
    });
    const result = await Promise.race([
      loaderPromise.then(() => "resolved"),
      new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 0)),
    ]);

    expect(result).toBe("resolved");
    expect(mocks.prefetchInboxHotQueries).toHaveBeenCalledWith(
      queryClient,
      expect.objectContaining({ filter: "all", timezoneOffsetMinutes: 300 }),
    );
  });
});
