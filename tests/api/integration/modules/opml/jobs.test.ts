import { describe, expect, mock, test } from "bun:test";

/**
 * Drives jobs.ts through the real @modules/opml/store and @modules/opml/known-feeds functions
 * with fake Postgres-shaped db objects, rather than mock.module(...) on those two modules:
 * mock.module's replacement is process-wide and not reliably undone by mock.restore() once the
 * suite has enough files (confirmed by reproducing the leak at ~50 files) -- it corrupted
 * store.test.ts's and known-feeds.test.ts's real-implementation tests depending on run order.
 *
 * @adapters/queue/publish-job is left unmocked for the same reason: opml-import-dispatcher.ts
 * (exercised unmocked by recovery.test.ts and opml-import-dispatcher.test.ts) imports the real
 * publishJob, so mocking it here leaked into those files' real-implementation assertions about
 * how the real publishJob behaves against a fake redis client. getRedis() (from @adapters/redis,
 * confirmed safe -- no other file imports it unmocked) is mocked instead to return a fake redis
 * with a controllable .xadd, the same technique recovery.test.ts and
 * opml-import-dispatcher.test.ts already use.
 *
 * @modules/feeds/subscription/subscribe, @modules/feeds/refresh/enqueue, and
 * @modules/opml/task-store have no other file importing them unmocked, so those three stay
 * mocked here.
 */
const createOrSubscribeToFeedMock = mock(async () => ({
  feedId: "feed-1",
  subscriptionId: "sub-1",
  newFeed: true,
  newSubscription: true,
}));
const enqueueFeedRefreshMock = mock(async () => ({ jobId: "job-1" }));
const recordOpmlTaskSuccessMock = mock(async () => undefined);
const subscribeToExistingFeedMock = mock(async () => ({
  feedId: "feed-1",
  subscriptionId: "sub-1",
  newFeed: false,
  newSubscription: false,
}));
const redisXaddMock = mock(async () => "stream-id-1");

mock.module("@modules/feeds/subscription/subscribe", () => ({
  createOrSubscribeToFeed: createOrSubscribeToFeedMock,
  subscribeToExistingFeed: subscribeToExistingFeedMock,
}));
mock.module("@modules/feeds/refresh/enqueue", () => ({
  enqueueBatchFeedRefresh: mock(async () => ({ accepted: true, count: 0, failedCount: 0 })),
  enqueueFeedRefresh: enqueueFeedRefreshMock,
}));
mock.module("@modules/opml/task-store", () => ({
  buildOpmlSummary: mock(() => ({
    totalUrls: 0,
    completed: 0,
    subscribed: 0,
    alreadySubscribed: 0,
    failed: 0,
    cancelled: 0,
    failures: [],
  })),
  cancelOpmlTask: mock(async () => undefined),
  deleteOpmlTask: mock(async () => true),
  failOpmlTask: mock(async () => undefined),
  getOpmlTask: mock(async () => null),
  getOpmlTaskOwner: mock(async () => null),
  initializeOpmlTask: mock(async () => undefined),
  isOpmlTaskCancelled: mock(async () => false),
  isTerminalOpmlStatus: mock(() => false),
  listActiveOpmlTasksForUser: mock(async () => []),
  markOpmlTaskInProgress: mock(async () => undefined),
  recordOpmlTaskSuccess: recordOpmlTaskSuccessMock,
  recordOpmlTaskFailure: mock(async () => undefined),
}));
mock.module("@adapters/redis", () => ({
  getRedis: mock(() => ({ xadd: redisXaddMock })),
}));

const { enqueueOpmlImport, runOpmlImportFeedJob, runOpmlImportPrepareJob, runOpmlImportItemJob } =
  await import("@modules/opml/jobs");

function logger() {
  return {
    info: mock(() => undefined),
    warn: mock(() => undefined),
    error: mock(() => undefined),
  };
}

function importRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "import-1",
    userId: "user-1",
    filename: "feeds.opml",
    sourceUrl: null,
    sourceXml: '<opml><body><outline xmlUrl="https://example.com/feed.xml"/></body></opml>',
    status: "accepted",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("enqueueOpmlImport", () => {
  /** Models createOpmlImport's insert chain and recordOpmlImportPrepareWakeup's update chain. */
  function createFakeEnqueueDb(created: Record<string, unknown>) {
    const db = {
      insert: () => ({
        values: () => ({ returning: () => Promise.resolve([created]) }),
      }),
      update: () => ({
        set: () => ({ where: () => Promise.resolve() }),
      }),
    };
    return db;
  }

  test("creates the durable import row and publishes an ID-only prepare wakeup", async () => {
    redisXaddMock.mockClear();
    const created = importRow({ id: "import-1", userId: "user-1", status: "accepted" });
    const db = createFakeEnqueueDb(created);
    const testLogger = logger();

    const result = await enqueueOpmlImport(
      db as never,
      "user-1",
      '<opml><body><outline xmlUrl="https://example.com/feed.xml"/></body></opml>',
      testLogger,
      "feeds.opml",
    );

    expect(result).toEqual({ taskId: "import-1" });
    // publishJob (real, unmocked) XADDs the prepare wakeup through getRedis()'s fake .xadd.
    expect(redisXaddMock).toHaveBeenCalledTimes(1);
    expect(testLogger.error).not.toHaveBeenCalled();
  });

  test("still returns the taskId when publishing the prepare wakeup fails", async () => {
    redisXaddMock.mockImplementationOnce(async () => {
      throw new Error("redis unavailable");
    });
    const created = importRow({ id: "import-1", userId: "user-1", status: "accepted" });
    const db = createFakeEnqueueDb(created);
    const testLogger = logger();

    const result = await enqueueOpmlImport(db as never, "user-1", "<opml></opml>", testLogger);

    expect(result).toEqual({ taskId: "import-1" });
    expect(testLogger.error).toHaveBeenCalledWith(
      "opml.import.prepare.delivery_pending",
      expect.objectContaining({ userId: "user-1", taskId: "import-1" }),
    );
  });
});

describe("runOpmlImportFeedJob", () => {
  test("enqueues a first refresh for newly imported subscriptions", async () => {
    const testLogger = logger();

    await runOpmlImportFeedJob(
      {} as never,
      {
        taskId: "task-1",
        userId: "user-1",
        url: "https://example.com/feed.xml",
        title: "Example",
        folderId: null,
      },
      testLogger,
    );

    expect(enqueueFeedRefreshMock).toHaveBeenCalledWith(
      {},
      "feed-1",
      "user-1",
      "subscription_created",
      testLogger,
    );
    expect(recordOpmlTaskSuccessMock).toHaveBeenCalledWith("task-1", {
      alreadySubscribed: false,
    });
  });
});

describe("runOpmlImportPrepareJob", () => {
  function buildOpmlWithFeedCount(count: number): string {
    const outlines = Array.from(
      { length: count },
      (_, i) => `<outline xmlUrl="https://example.com/feed-${i}.xml"/>`,
    ).join("");
    return `<opml><body>${outlines}</body></opml>`;
  }

  /**
   * Drives claimOpmlPreparation (update+returning) and every select() that follows in call
   * order: (1) countOpmlImportItems, a bare await with no .limit(); (2)
   * matchKnownFeedsForImport's pending-items select, also a bare await, which returns []
   * (nothing new to match by URL) so it never issues a candidate lookup or update; (3)
   * subscribeKnownOpmlItems' outer matched-items select (.limit()), which also returns [] so
   * subscribeKnownOpmlItems returns the empty completion without opening a transaction and the
   * drain loop's single iteration ends with processed === 0; (4) finalizeOpmlImportPreparation's
   * totals select (.limit()). This covers every prepare-job test except the "drains known-feed
   * matches" one below, which has its own bespoke fake since it drives subscribeKnownOpmlItems'
   * transaction for real.
   */
  function createFakePrepareDb(options: {
    claimed?: Record<string, unknown> | null;
    finalizeTotals?: Record<string, unknown>;
  }) {
    const opts = {
      claimed: null,
      finalizeTotals: {
        totalItems: 0,
        subscribedItems: 0,
        alreadySubscribedItems: 0,
        failedItems: 0,
      },
      ...options,
    };
    const insertedBatches: unknown[][] = [];
    const updateSets: Array<Record<string, unknown>> = [];
    let topSelectCount = 0;
    let countedItems = 0;

    function withLimit<T>(rows: T[]): Promise<T[]> & { limit: () => Promise<T[]> } {
      return Object.assign(Promise.resolve(rows), { limit: () => Promise.resolve(rows) });
    }

    const db = {
      update: () => ({
        set: (patch: Record<string, unknown>) => {
          updateSets.push(patch);
          if (patch.status === "parsing") {
            return {
              where: () => ({
                returning: () => Promise.resolve(opts.claimed ? [opts.claimed] : []),
              }),
            };
          }
          return { where: () => Promise.resolve() };
        },
      }),
      insert: () => ({
        values: (rows: unknown[]) => {
          insertedBatches.push(rows);
          countedItems += rows.length;
          return { onConflictDoNothing: () => Promise.resolve() };
        },
      }),
      select: () => ({
        from: () => ({
          where: () => {
            topSelectCount += 1;
            if (topSelectCount === 1) {
              return Promise.resolve([{ total: countedItems }]);
            }
            if (topSelectCount === 2) {
              return Promise.resolve([]);
            }
            if (topSelectCount === 3) {
              return withLimit([]);
            }
            return withLimit([opts.finalizeTotals]);
          },
        }),
      }),
      transaction: async () => {
        throw new Error("must not open a transaction when nothing matched");
      },
    };

    return { db, insertedBatches, updateSets };
  }

  test("materializes items in chunks of at most 500 and finalizes once", async () => {
    const claimed = {
      importId: "import-1",
      userId: "user-1",
      filename: "feeds.opml",
      sourceXml: buildOpmlWithFeedCount(1201),
    };
    const { db, insertedBatches, updateSets } = createFakePrepareDb({ claimed });
    const testLogger = logger();

    await runOpmlImportPrepareJob(db as never, { importId: "import-1" }, testLogger);

    expect(insertedBatches).toHaveLength(3);
    expect(insertedBatches[0]).toHaveLength(500);
    expect(insertedBatches[1]).toHaveLength(500);
    expect(insertedBatches[2]).toHaveLength(201);
    expect(updateSets.some((patch) => patch.totalItems === 1201)).toBe(true);
    expect(updateSets.some((patch) => patch.status === "failed")).toBe(false);
  });

  test("performs no work for a duplicate or missing prepare wakeup", async () => {
    const insert = mock(() => {
      throw new Error("must not be called");
    });
    const { db: baseDb } = createFakePrepareDb({ claimed: null });
    const db = { ...baseDb, insert };
    const testLogger = logger();

    await runOpmlImportPrepareJob(db as never, { importId: "import-1" }, testLogger);

    expect(insert).not.toHaveBeenCalled();
  });

  test("fails the import on invalid XML without throwing", async () => {
    const claimed = {
      importId: "import-1",
      userId: "user-1",
      filename: "feeds.opml",
      sourceXml: "<opml><body></body></opml>",
    };
    const { db, updateSets } = createFakePrepareDb({ claimed });
    const testLogger = logger();

    await runOpmlImportPrepareJob(db as never, { importId: "import-1" }, testLogger);

    expect(updateSets).toContainEqual(
      expect.objectContaining({ status: "failed", lastErrorCode: "OPML_NO_FEEDS" }),
    );
  });

  test("rethrows platform errors so the queue retries instead of failing the import", async () => {
    const claimed = {
      importId: "import-1",
      userId: "user-1",
      filename: "feeds.opml",
      sourceXml: buildOpmlWithFeedCount(5),
    };
    const { db: baseDb, updateSets } = createFakePrepareDb({ claimed });
    const db = {
      ...baseDb,
      insert: () => ({
        values: () => {
          throw new Error("connection reset");
        },
      }),
    };
    const testLogger = logger();

    await expect(
      runOpmlImportPrepareJob(db as never, { importId: "import-1" }, testLogger),
    ).rejects.toThrow("connection reset");
    expect(updateSets.some((patch) => patch.status === "failed")).toBe(false);
  });

  test("drains known-feed matches in a loop and publishes refresh candidates before finalizing", async () => {
    enqueueFeedRefreshMock.mockClear();
    const claimed = {
      importId: "import-1",
      userId: "user-1",
      filename: "feeds.opml",
      sourceXml: buildOpmlWithFeedCount(5),
    };
    const updateSets: Array<Record<string, unknown>> = [];
    let topSelectCount = 0;

    function withLimit<T>(rows: T[]): Promise<T[]> & { limit: () => Promise<T[]> } {
      return Object.assign(Promise.resolve(rows), { limit: () => Promise.resolve(rows) });
    }

    const db = {
      update: () => ({
        set: (patch: Record<string, unknown>) => {
          updateSets.push(patch);
          if (patch.status === "parsing") {
            return { where: () => ({ returning: () => Promise.resolve([claimed]) }) };
          }
          return { where: () => Promise.resolve() };
        },
      }),
      insert: () => ({
        values: () => ({ onConflictDoNothing: () => Promise.resolve() }),
      }),
      select: () => ({
        from: () => ({
          where: () => {
            topSelectCount += 1;
            // Exact call order for one match (up front, not re-run per drain round) followed by
            // a drain loop that finds one match then stops:
            // 1 countOpmlImportItems (bare), 2 match-pending (bare, once), 3 subscribe-matched
            // round 1 (.limit, finds 1 item), 4 subscribe-matched round 2 (.limit, finds none --
            // processed===0 ends the loop), 5 finalize totals (.limit).
            if (topSelectCount === 1 || topSelectCount === 2) {
              return Promise.resolve(topSelectCount === 1 ? [{ total: 5 }] : []);
            }
            if (topSelectCount === 3) {
              return withLimit([{ id: "item-1", feedId: "feed-1", folderId: null, title: null }]);
            }
            if (topSelectCount === 4) {
              return withLimit([]);
            }
            // finalizeOpmlImportPreparation's totals select.
            return withLimit([
              { totalItems: 5, subscribedItems: 1, alreadySubscribedItems: 0, failedItems: 0 },
            ]);
          },
        }),
      }),
      transaction: async (callback: (tx: unknown) => unknown) => {
        let txSelectCount = 0;
        const tx = {
          select: () => ({
            from: () => ({
              where: () => {
                txSelectCount += 1;
                if (txSelectCount === 1) {
                  // parent status lookup.
                  return { limit: () => Promise.resolve([{ status: "parsing" }]) };
                }
                if (txSelectCount === 2) {
                  // existing subscriptions for feed-1: none.
                  return Promise.resolve([]);
                }
                // feedIdsNeedingInitialRefresh's two selects: feed-1 has no prior refresh and no
                // items yet, so it qualifies as a refresh candidate.
                return Promise.resolve([]);
              },
            }),
          }),
          insert: () => ({
            values: (rows: Array<Record<string, unknown>>) => ({
              onConflictDoNothing: () => ({
                returning: () => Promise.resolve(rows.map((row) => ({ feedId: row.feedId }))),
              }),
            }),
          }),
          update: () => ({
            set: () => ({
              where: () => ({ returning: () => Promise.resolve([{ id: "item-1" }]) }),
            }),
          }),
        };
        return callback(tx);
      },
    };
    const testLogger = logger();

    await runOpmlImportPrepareJob(db as never, { importId: "import-1" }, testLogger);

    expect(enqueueFeedRefreshMock).toHaveBeenCalledWith(
      db,
      "feed-1",
      "user-1",
      "subscription_created",
      testLogger,
    );
    expect(
      updateSets.some((patch) => patch.status === "completed" || patch.status === "dispatching"),
    ).toBe(true);
  });
});

describe("runOpmlImportItemJob", () => {
  function claimedItem(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "item-1",
      importId: "import-1",
      originalUrl: "https://example.com/feed.xml",
      normalizedUrl: "https://example.com/feed.xml",
      title: null,
      folderName: "Unsorted",
      folderId: null,
      feedId: null,
      leaseToken: "lease-1",
      attempts: 1,
      ...overrides,
    };
  }

  /** Models claimLeasedOpmlItem's update+returning and its follow-up parent-userId select. */
  function createFakeClaimDb(options: {
    claimedRow?: Record<string, unknown> | null;
    parentUserId?: string;
  }) {
    const opts = { claimedRow: null, parentUserId: "user-1", ...options };
    return {
      update: () => ({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve(opts.claimedRow ? [opts.claimedRow] : []),
          }),
        }),
      }),
      select: () => ({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([{ userId: opts.parentUserId }]) }),
        }),
      }),
    };
  }

  test("returns successfully with no fetch when the lease claim is stale or already gone", async () => {
    subscribeToExistingFeedMock.mockClear();
    createOrSubscribeToFeedMock.mockClear();
    const db = createFakeClaimDb({ claimedRow: null });
    const testLogger = logger();

    await runOpmlImportItemJob(
      db as never,
      { importId: "import-1", itemId: "item-1", leaseToken: "lease-1" },
      testLogger,
    );

    expect(subscribeToExistingFeedMock).not.toHaveBeenCalled();
    expect(createOrSubscribeToFeedMock).not.toHaveBeenCalled();
  });

  /** Models completeOpmlItem's transaction: item update (returning) then parent counter update. */
  function withCompleteTransaction(db: Record<string, unknown>) {
    return {
      ...db,
      transaction: async (callback: (tx: unknown) => unknown) => {
        let txUpdateCount = 0;
        const tx = {
          update: () => ({
            set: () => ({
              where: () => {
                txUpdateCount += 1;
                return txUpdateCount === 1
                  ? { returning: () => Promise.resolve([{ id: "item-1" }]) }
                  : Promise.resolve();
              },
            }),
          }),
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () =>
                  Promise.resolve([
                    {
                      totalItems: 1,
                      subscribedItems: 1,
                      alreadySubscribedItems: 0,
                      failedItems: 0,
                      cancelledItems: 0,
                    },
                  ]),
              }),
            }),
          }),
        };
        return callback(tx);
      },
    };
  }

  test("subscribes by feedId without a remote fetch when the item already has a known feed", async () => {
    subscribeToExistingFeedMock.mockClear();
    createOrSubscribeToFeedMock.mockClear();
    enqueueFeedRefreshMock.mockClear();
    subscribeToExistingFeedMock.mockImplementationOnce(async () => ({
      feedId: "feed-known",
      subscriptionId: "sub-1",
      newFeed: false,
      newSubscription: true,
    }));
    const claimed = claimedItem({
      title: "Custom Title",
      folderName: "Tech",
      folderId: "folder-1",
      feedId: "feed-known",
    });
    const db = withCompleteTransaction(createFakeClaimDb({ claimedRow: claimed }));
    const testLogger = logger();

    await runOpmlImportItemJob(
      db as never,
      { importId: "import-1", itemId: "item-1", leaseToken: "lease-1" },
      testLogger,
    );

    expect(subscribeToExistingFeedMock).toHaveBeenCalledWith(db, "user-1", "feed-known", {
      folderId: "folder-1",
      customTitle: "Custom Title",
    });
    expect(createOrSubscribeToFeedMock).not.toHaveBeenCalled();
    expect(enqueueFeedRefreshMock).toHaveBeenCalledWith(
      db,
      "feed-known",
      "user-1",
      "subscription_created",
      testLogger,
    );
  });

  test("falls back to createOrSubscribeToFeed when the item has no known feed", async () => {
    createOrSubscribeToFeedMock.mockClear();
    createOrSubscribeToFeedMock.mockImplementationOnce(async () => ({
      feedId: "feed-1",
      subscriptionId: "sub-1",
      newFeed: true,
      newSubscription: true,
    }));
    const claimed = claimedItem({
      originalUrl: "https://example.com/unknown.xml",
      normalizedUrl: "https://example.com/unknown.xml",
      feedId: null,
    });
    const db = withCompleteTransaction(createFakeClaimDb({ claimedRow: claimed }));
    const testLogger = logger();

    await runOpmlImportItemJob(
      db as never,
      { importId: "import-1", itemId: "item-1", leaseToken: "lease-1" },
      testLogger,
    );

    expect(createOrSubscribeToFeedMock).toHaveBeenCalledWith(
      db,
      "user-1",
      "https://example.com/unknown.xml",
      { folderId: null, customTitle: null },
    );
  });

  test("classifies and durably persists a retryable failure without throwing", async () => {
    createOrSubscribeToFeedMock.mockClear();
    createOrSubscribeToFeedMock.mockImplementationOnce(async () => {
      throw new Error("connection reset");
    });
    const claimed = claimedItem({
      originalUrl: "https://example.com/unknown.xml",
      normalizedUrl: "https://example.com/unknown.xml",
      feedId: null,
      attempts: 1,
    });
    const updateSets: Array<Record<string, unknown>> = [];
    // claimLeasedOpmlItem's update (status: "processing") returns the claim via .returning();
    // retryOrFailOpmlItem's subsequent update (a retryable, non-final attempt, status: "pending")
    // has no .returning() call at all. Dispatch on the patch's status to give each the right shape.
    const db = {
      update: () => ({
        set: (patch: Record<string, unknown>) => {
          updateSets.push(patch);
          if (patch.status === "processing") {
            return { where: () => ({ returning: () => Promise.resolve([claimed]) }) };
          }
          return { where: () => Promise.resolve() };
        },
      }),
      select: () => ({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([{ userId: "user-1" }]) }) }),
      }),
    };
    const testLogger = logger();

    await runOpmlImportItemJob(
      db as never,
      { importId: "import-1", itemId: "item-1", leaseToken: "lease-1" },
      testLogger,
    );

    expect(
      updateSets.some((patch) => patch.status === "pending" && patch.leaseToken === null),
    ).toBe(true);
  });
});
