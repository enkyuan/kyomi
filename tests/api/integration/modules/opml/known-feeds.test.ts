import { describe, expect, mock, test } from "bun:test";
import {
  matchKnownFeedsForImport,
  publishKnownFeedRefreshCandidates,
  subscribeKnownOpmlItems,
} from "@modules/opml/known-feeds";

function pendingItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "item-1",
    normalizedUrl: "https://example.com/feed.xml",
    ...overrides,
  };
}

describe("matchKnownFeedsForImport", () => {
  test("matches exact feeds.url before submittedUrl/canonicalFeedUrl aliases", async () => {
    const pending = [
      pendingItem({ id: "item-1", normalizedUrl: "https://example.com/exact.xml" }),
      pendingItem({ id: "item-2", normalizedUrl: "https://example.com/alias.xml" }),
      pendingItem({ id: "item-3", normalizedUrl: "https://example.com/unknown.xml" }),
    ];
    const candidateFeeds = [
      {
        id: "feed-exact",
        url: "https://example.com/exact.xml",
        submittedUrl: null,
        canonicalFeedUrl: null,
      },
      {
        id: "feed-alias",
        url: "https://cdn.example.com/x",
        submittedUrl: "https://example.com/alias.xml",
        canonicalFeedUrl: null,
      },
    ];
    let selectCount = 0;
    const executeCalls: unknown[] = [];
    const fakeDb = {
      select: () => ({
        from: () => ({
          where: () => {
            selectCount += 1;
            return selectCount === 1 ? Promise.resolve(pending) : Promise.resolve(candidateFeeds);
          },
        }),
      }),
      execute: (query: unknown) => {
        executeCalls.push(query);
        // Both item-1 (exact) and item-2 (alias) match; item-3 does not.
        return Promise.resolve([{ id: "item-1" }, { id: "item-2" }]);
      },
    } as unknown as Parameters<typeof matchKnownFeedsForImport>[0];

    const matched = await matchKnownFeedsForImport(fakeDb, "import-1");

    expect(matched).toBe(2);
    expect(executeCalls).toHaveLength(1);
  });

  test("returns 0 without any update when there are no pending items", async () => {
    const execute = mock(() => {
      throw new Error("must not be called");
    });
    const fakeDb = {
      select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
      execute,
    } as unknown as Parameters<typeof matchKnownFeedsForImport>[0];

    expect(await matchKnownFeedsForImport(fakeDb, "import-1")).toBe(0);
    expect(execute).not.toHaveBeenCalled();
  });

  test("processes pending items in chunks of at most 500", async () => {
    const pending = Array.from({ length: 1201 }, (_, i) =>
      pendingItem({ id: `item-${i}`, normalizedUrl: `https://example.com/feed-${i}.xml` }),
    );
    const selectFromCalls: number[] = [];
    let selectCount = 0;
    const fakeDb = {
      select: () => ({
        from: () => ({
          where: () => {
            selectCount += 1;
            if (selectCount === 1) {
              return Promise.resolve(pending);
            }
            selectFromCalls.push(0);
            return Promise.resolve([]);
          },
        }),
      }),
      execute: () => Promise.resolve([]),
    } as unknown as Parameters<typeof matchKnownFeedsForImport>[0];

    await matchKnownFeedsForImport(fakeDb, "import-1");

    // One candidate-lookup select per chunk of at most 500 pending items: 500 + 500 + 201 = 3.
    expect(selectFromCalls).toHaveLength(3);
  });
});

/**
 * Models the fixed call sequence subscribeKnownOpmlItems issues: an outer select for matched
 * items, then (inside the transaction) select-parent, select-existing-subs, insert-subs,
 * update-subscribed, update-already_subscribed, update-parent-counters, and finally the two
 * feedIdsNeedingInitialRefresh selects. Each step is modeled by call order, matching the
 * source's actual sequence rather than trying to distinguish Drizzle table objects.
 */
function createFakeKnownFeedsDb(options: {
  matchedItems: Array<{
    id: string;
    feedId: string;
    folderId: string | null;
    title: string | null;
  }>;
  existingSubscriptionFeedIds: string[];
  importStatus: string;
}) {
  const insertedSubscriptions: Array<Record<string, unknown>> = [];
  const importCounterPatches: Array<Record<string, unknown>> = [];
  let txSelectCount = 0;
  let txUpdateCount = 0;

  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(options.matchedItems),
        }),
      }),
    }),
    transaction: async (callback: (tx: unknown) => unknown) => {
      const tx = {
        select: () => ({
          from: () => ({
            where: () => {
              txSelectCount += 1;
              if (txSelectCount === 1) {
                // select parent status
                return { limit: () => Promise.resolve([{ status: options.importStatus }]) };
              }
              if (txSelectCount === 2) {
                // select existing subscriptions
                return Promise.resolve(
                  options.existingSubscriptionFeedIds.map((feedId) => ({ feedId })),
                );
              }
              // feedIdsNeedingInitialRefresh's two selects: no matches by default.
              return Promise.resolve([]);
            },
          }),
        }),
        insert: () => ({
          values: (rows: Array<Record<string, unknown>>) => ({
            onConflictDoNothing: () => ({
              returning: () => {
                const inserted = rows.filter(
                  (row) => !options.existingSubscriptionFeedIds.includes(row.feedId as string),
                );
                insertedSubscriptions.push(...inserted);
                return Promise.resolve(inserted.map((row) => ({ feedId: row.feedId })));
              },
            }),
          }),
        }),
        update: () => ({
          set: (patch: Record<string, unknown>) => ({
            where: () => {
              txUpdateCount += 1;
              if (txUpdateCount === 3) {
                // update parent counters: no .returning() call in the source.
                importCounterPatches.push(patch);
                return Promise.resolve();
              }
              return {
                returning: () => Promise.resolve([{ id: "ok" }]),
              };
            },
          }),
        }),
      };
      return callback(tx);
    },
  };

  return { db, insertedSubscriptions, importCounterPatches };
}

describe("subscribeKnownOpmlItems", () => {
  test("returns an empty completion when there is nothing pending with a matched feed", async () => {
    const { db } = createFakeKnownFeedsDb({
      matchedItems: [],
      existingSubscriptionFeedIds: [],
      importStatus: "parsing",
    });

    const result = await subscribeKnownOpmlItems(db as never, "import-1", "user-1");

    expect(result).toEqual({
      processed: 0,
      subscribed: 0,
      alreadySubscribed: 0,
      refreshCandidateFeedIds: [],
    });
  });

  test("does not subscribe anything once the import has left the parsing state", async () => {
    const { db, insertedSubscriptions } = createFakeKnownFeedsDb({
      matchedItems: [{ id: "item-1", feedId: "feed-1", folderId: null, title: null }],
      existingSubscriptionFeedIds: [],
      importStatus: "cancelling",
    });

    const result = await subscribeKnownOpmlItems(db as never, "import-1", "user-1");

    expect(result.processed).toBe(0);
    expect(insertedSubscriptions).toHaveLength(0);
  });

  test("inserts new subscriptions and marks preexisting ones already_subscribed", async () => {
    const { db, insertedSubscriptions, importCounterPatches } = createFakeKnownFeedsDb({
      matchedItems: [
        { id: "item-1", feedId: "feed-new", folderId: "folder-1", title: "Feed A" },
        { id: "item-2", feedId: "feed-existing", folderId: null, title: null },
      ],
      existingSubscriptionFeedIds: ["feed-existing"],
      importStatus: "parsing",
    });

    const result = await subscribeKnownOpmlItems(db as never, "import-1", "user-1");

    expect(result.processed).toBe(2);
    expect(result.subscribed).toBe(1);
    expect(result.alreadySubscribed).toBe(1);
    expect(insertedSubscriptions).toHaveLength(1);
    expect(insertedSubscriptions[0]).toMatchObject({ feedId: "feed-new", folderId: "folder-1" });
    expect(importCounterPatches).toHaveLength(1);
  });
});

describe("publishKnownFeedRefreshCandidates", () => {
  test("publishes every candidate and logs, without throwing, on individual failures", async () => {
    const enqueueFeedRefreshMock = mock(async (_db: unknown, feedId: string) => {
      if (feedId === "feed-2") {
        throw new Error("queue unavailable");
      }
      return { jobId: "job-1" };
    });
    mock.module("@modules/feeds/refresh/enqueue", () => ({
      enqueueFeedRefresh: enqueueFeedRefreshMock,
    }));
    const { publishKnownFeedRefreshCandidates: publish } =
      await import("@modules/opml/known-feeds");
    const logger = { info: mock(() => undefined), error: mock(() => undefined) };

    await publish({} as never, "user-1", ["feed-1", "feed-2", "feed-3"], logger);

    expect(enqueueFeedRefreshMock).toHaveBeenCalledTimes(3);
    expect(logger.error).toHaveBeenCalledWith(
      "opml.import.known_feed.refresh_publish_failed",
      expect.objectContaining({ feedId: "feed-2" }),
    );
  });
});
