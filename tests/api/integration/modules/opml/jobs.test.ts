import { describe, expect, mock, test } from "bun:test";
import { Effect, Layer } from "effect";
import { enqueueOpmlImport } from "@modules/opml/enqueue";
import {
  runOpmlImportFeedJob,
  runOpmlImportItemJob,
  runOpmlImportJob,
  runOpmlImportPrepareJob,
} from "@modules/opml/jobs";
import { BadRequest, InternalError } from "@shared/effect/errors";
import {
  fakeDb as dbLayer,
  fakeQueue,
  fakeRedis,
  recordingLogger,
} from "@api-tests/support/layers";
import { feedsLayer } from "./fixtures";

/**
 * Drives jobs.ts through the real store, known-feed and task code with fake Postgres- and
 * Redis-shaped clients behind the real `Db`, `Redis` and `JobQueue` services. The feeds and
 * folders domains are the only seam replaced, through the `OpmlFeeds` service.
 */
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

/**
 * A fake ioredis `multi()`: each call returns a chain that records its commands and answers
 * `exec` with the next entry of `results` (one array of command values per transaction).
 */
function fakeMulti(commands: unknown[][], results: unknown[][]) {
  let transaction = 0;
  return () => {
    const values = results[transaction] ?? [];
    transaction += 1;
    const chain: Record<string, unknown> = new Proxy(
      {},
      {
        get: (_, name) =>
          name === "exec"
            ? async () => values.map((value) => [null, value])
            : (...args: unknown[]) => {
                commands.push([name, ...args]);
                return chain;
              },
      },
    );
    return chain;
  };
}

describe("enqueueOpmlImport", () => {
  /** Models createOpmlImport's insert chain and recordOpmlImportPrepareWakeup's update chain. */
  function createFakeEnqueueDb(created: Record<string, unknown>) {
    return {
      insert: () => ({
        values: () => ({ returning: () => Promise.resolve([created]) }),
      }),
      update: () => ({
        set: () => ({ where: () => Promise.resolve() }),
      }),
    };
  }

  const xml = '<opml><body><outline xmlUrl="https://example.com/feed.xml"/></body></opml>';

  test("creates the durable import row and publishes an ID-only prepare wakeup", async () => {
    const xadd = mock(async () => "stream-id-1");
    const logs = recordingLogger();
    const db = createFakeEnqueueDb(importRow());

    const result = await Effect.runPromise(
      enqueueOpmlImport({ userId: "user-1", xml, filename: "feeds.opml" }).pipe(
        Effect.provide(Layer.mergeAll(dbLayer(db), fakeQueue({ xadd }), logs.layer)),
      ),
    );

    expect(result).toEqual({ taskId: "import-1" });
    expect(xadd).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(xadd.mock.calls[0])).toContain("import-1");
    expect(logs.entries.filter((entry) => entry.level === "error")).toEqual([]);
    expect(logs.entries).toContainEqual(
      expect.objectContaining({ event: "opml.import.enqueued", context: expect.any(Object) }),
    );
  });

  test("still returns the taskId when publishing the prepare wakeup fails", async () => {
    const logs = recordingLogger();
    const db = createFakeEnqueueDb(importRow());

    const result = await Effect.runPromise(
      enqueueOpmlImport({ userId: "user-1", xml: "<opml></opml>" }).pipe(
        Effect.provide(
          Layer.mergeAll(
            dbLayer(db),
            fakeQueue({
              xadd: async () => {
                throw new Error("redis unavailable");
              },
            }),
            logs.layer,
          ),
        ),
      ),
    );

    expect(result).toEqual({ taskId: "import-1" });
    expect(logs.entries).toContainEqual(
      expect.objectContaining({
        level: "error",
        event: "opml.import.prepare.delivery_pending",
        context: expect.objectContaining({ userId: "user-1", taskId: "import-1" }),
      }),
    );
  });

  test("rejects a filename that is not .opml or .xml before storing anything", async () => {
    const error = await Effect.runPromise(
      Effect.flip(enqueueOpmlImport({ userId: "user-1", xml, filename: "feeds.txt" })).pipe(
        Effect.provide(Layer.mergeAll(dbLayer({}), fakeQueue({}), recordingLogger().layer)),
      ),
    );

    expect(error).toBeInstanceOf(BadRequest);
    expect(error).toMatchObject({ code: "OPML_FILE_TYPE_INVALID" });
  });
});

describe("legacy opml.import.feed job", () => {
  const payload = {
    taskId: "task-1",
    userId: "user-1",
    url: "https://example.com/feed.xml",
    title: "Example",
    folderId: null,
  };

  function run(
    feeds: ReturnType<typeof feedsLayer>,
    redisCommands: { transaction: unknown[][]; results: unknown[][] },
  ) {
    const logs = recordingLogger();
    const redis = fakeRedis({
      exists: async () => 0,
      multi: fakeMulti(redisCommands.transaction, redisCommands.results),
    });
    return {
      logs,
      done: Effect.runPromise(
        runOpmlImportFeedJob(payload).pipe(
          Effect.provide(Layer.mergeAll(feeds.layer, redis, logs.layer)),
        ),
      ),
    };
  }

  test("enqueues a first refresh for newly imported subscriptions and counts the success", async () => {
    const feeds = feedsLayer();
    const transaction: unknown[][] = [];

    // The counter transaction (completed = 1), then getOpmlTask's [meta, counters, errors] for
    // the finalize check: no stored meta, so nothing to finalize.
    await run(feeds, {
      transaction,
      results: [
        [1, 1, 1],
        [null, {}, []],
      ],
    }).done;

    expect(feeds.calls.subscribeToFeedUrl[0]).toEqual([
      "user-1",
      "https://example.com/feed.xml",
      { folderId: null, customTitle: "Example" },
    ]);
    expect(feeds.calls.requestInitialRefresh).toEqual([["feed-1", "user-1"]]);
    expect(transaction[0]).toEqual(["hincrby", "kyomi:opml:task:task-1:counters", "subscribed", 1]);
  });

  test("records a typed failure against the task and still succeeds", async () => {
    const feeds = feedsLayer({
      subscribeToFeedUrl: () =>
        Effect.fail(new BadRequest({ message: "bad feed", code: "INVALID_FEED_URL" })),
    });
    const transaction: unknown[][] = [];

    const { logs, done } = run(feeds, {
      transaction,
      results: [
        [1, 1, 1, 1, 1],
        [null, {}, []],
      ],
    });
    await done;

    expect(transaction.find(([command]) => command === "rpush")).toEqual([
      "rpush",
      "kyomi:opml:task:task-1:errors",
      JSON.stringify({
        url: "https://example.com/feed.xml",
        code: "INVALID_FEED_URL",
        message: "bad feed",
      }),
    ]);
    expect(feeds.calls.requestInitialRefresh).toEqual([]);
    expect(logs.entries).toContainEqual(
      expect.objectContaining({
        level: "error",
        event: "worker.job.opml_import_feed.failed",
        context: expect.objectContaining({ code: "INVALID_FEED_URL" }),
      }),
    );
  });

  test("does no work for a cancelled task", async () => {
    const feeds = feedsLayer();
    const logs = recordingLogger();

    await Effect.runPromise(
      runOpmlImportFeedJob(payload).pipe(
        Effect.provide(
          Layer.mergeAll(feeds.layer, fakeRedis({ exists: async () => 1 }), logs.layer),
        ),
      ),
    );

    expect(feeds.calls.subscribeToFeedUrl).toEqual([]);
    expect(logs.entries.map((entry) => entry.event)).toEqual([
      "worker.job.opml_import_feed.cancelled",
    ]);
  });
});

describe("legacy opml.import job", () => {
  test("publishes one feed job per URL with its folder and stops when the task is cancelled", async () => {
    const xml = `<opml><body><outline text="Tech"><outline xmlUrl="https://a.example/f"/><outline xmlUrl="https://b.example/f"/></outline></body></opml>`;
    const published: string[] = [];
    let cancelChecks = 0;
    const feeds = feedsLayer({
      getOrCreateFolder: () => Effect.succeed({ id: "folder-tech" }),
    });

    await Effect.runPromise(
      runOpmlImportJob({ taskId: "task-1", userId: "user-1", xml, filename: "f.opml" }).pipe(
        Effect.provide(
          Layer.mergeAll(
            feeds.layer,
            fakeQueue({
              // Cancelled before the second feed is published.
              exists: async () => {
                cancelChecks += 1;
                return cancelChecks >= 3 ? 1 : 0;
              },
              multi: fakeMulti([], [[1, 1, 1, 1, 1]]),
              eval: async () => 1,
              xadd: async (...args: unknown[]) => {
                published.push(args.join(" "));
                return "1-0";
              },
            }),
            recordingLogger().layer,
          ),
        ),
      ),
    );

    expect(published).toHaveLength(1);
    expect(published[0]).toContain("https://a.example/f");
    expect(published[0]).toContain("folder-tech");
  });

  test("marks the task failed and fails the job when the document cannot be parsed", async () => {
    const evalCalls: unknown[][] = [];
    const logs = recordingLogger();

    const error = await Effect.runPromise(
      Effect.flip(
        runOpmlImportJob({
          taskId: "task-1",
          userId: "user-1",
          xml: "<opml><body></body></opml>",
          filename: "f.opml",
        }),
      ).pipe(
        Effect.provide(
          Layer.mergeAll(
            feedsLayer().layer,
            fakeQueue({
              exists: async () => 0,
              eval: async (...args: unknown[]) => {
                evalCalls.push(args);
                return 1;
              },
            }),
            logs.layer,
          ),
        ),
      ),
    );

    expect(error).toMatchObject({ _tag: "BadRequest", code: "OPML_NO_FEEDS" });
    // failOpmlTask patches the meta atomically with status "failed" and the error message.
    expect(String(evalCalls[0]?.[4])).toContain('"status":"failed"');
    expect(logs.entries.map((entry) => entry.event)).toContain("worker.job.opml_import.failed");
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

  function withLimit<T>(rows: T[]): Promise<T[]> & { limit: () => Promise<T[]> } {
    return Object.assign(Promise.resolve(rows), { limit: () => Promise.resolve(rows) });
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

  const runPrepare = (db: unknown, feeds = feedsLayer(), logs = recordingLogger()) =>
    runOpmlImportPrepareJob({ importId: "import-1" }).pipe(
      Effect.provide(Layer.mergeAll(dbLayer(db as never), feeds.layer, logs.layer)),
    );

  test("materializes items in chunks of at most 500 and finalizes once", async () => {
    const claimed = {
      importId: "import-1",
      userId: "user-1",
      filename: "feeds.opml",
      sourceXml: buildOpmlWithFeedCount(1201),
    };
    const { db, insertedBatches, updateSets } = createFakePrepareDb({ claimed });

    await Effect.runPromise(runPrepare(db));

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

    await Effect.runPromise(runPrepare({ ...baseDb, insert }));

    expect(insert).not.toHaveBeenCalled();
  });

  test("fails the import on invalid XML without failing the job", async () => {
    const claimed = {
      importId: "import-1",
      userId: "user-1",
      filename: "feeds.opml",
      sourceXml: "<opml><body></body></opml>",
    };
    const { db, updateSets } = createFakePrepareDb({ claimed });
    const logs = recordingLogger();

    await Effect.runPromise(runPrepare(db, feedsLayer(), logs));

    expect(updateSets).toContainEqual(
      expect.objectContaining({ status: "failed", lastErrorCode: "OPML_NO_FEEDS" }),
    );
    expect(logs.entries).toContainEqual(
      expect.objectContaining({
        level: "error",
        event: "worker.job.opml_import_prepare.failed",
        context: expect.objectContaining({ importId: "import-1", code: "OPML_NO_FEEDS" }),
      }),
    );
  });

  test("fails the import when the folders domain rejects the document's folders", async () => {
    const claimed = {
      importId: "import-1",
      userId: "user-1",
      filename: "feeds.opml",
      sourceXml: buildOpmlWithFeedCount(2),
    };
    const { db, updateSets } = createFakePrepareDb({ claimed });
    const feeds = feedsLayer({
      ensureFolders: () =>
        Effect.fail(
          new BadRequest({
            message: "Folder name exceeds maximum length",
            code: "FOLDER_NAME_TOO_LONG",
          }),
        ),
    });

    await Effect.runPromise(runPrepare(db, feeds));

    expect(updateSets).toContainEqual(
      expect.objectContaining({ status: "failed", lastErrorCode: "FOLDER_NAME_TOO_LONG" }),
    );
  });

  test("fails the job on platform errors so the queue retries instead of failing the import", async () => {
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

    const error = await Effect.runPromise(Effect.flip(runPrepare(db)));

    expect(error).toMatchObject({ _tag: "DatabaseError", operation: "opml.item.insert" });
    expect(updateSets.some((patch) => patch.status === "failed")).toBe(false);
  });

  test("drains known-feed matches in a loop and publishes refresh candidates before finalizing", async () => {
    const claimed = {
      importId: "import-1",
      userId: "user-1",
      filename: "feeds.opml",
      sourceXml: buildOpmlWithFeedCount(5),
    };
    const updateSets: Array<Record<string, unknown>> = [];
    let topSelectCount = 0;

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
                // existing subscriptions for feed-1 (none), then feedIdsNeedingInitialRefresh's
                // two selects: feed-1 has no prior refresh and no items yet, so it qualifies.
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
    const feeds = feedsLayer();

    await Effect.runPromise(runPrepare(db, feeds));

    expect(feeds.calls.requestInitialRefresh).toEqual([["feed-1", "user-1"]]);
    expect(
      updateSets.some((patch) => patch.status === "completed" || patch.status === "dispatching"),
    ).toBe(true);
  });
});

describe("runOpmlImportItemJob", () => {
  const payload = { importId: "import-1", itemId: "item-1", leaseToken: "lease-1" };

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

  const runItem = (db: unknown, feeds = feedsLayer(), logs = recordingLogger()) =>
    runOpmlImportItemJob(payload).pipe(
      Effect.provide(Layer.mergeAll(dbLayer(db as never), feeds.layer, logs.layer)),
    );

  test("returns successfully with no fetch when the lease claim is stale or already gone", async () => {
    const feeds = feedsLayer();

    await Effect.runPromise(runItem(createFakeClaimDb({ claimedRow: null }), feeds));

    expect(feeds.calls.subscribeToKnownFeed).toEqual([]);
    expect(feeds.calls.subscribeToFeedUrl).toEqual([]);
  });

  test("subscribes by feedId without a remote fetch when the item already has a known feed", async () => {
    const feeds = feedsLayer();
    const claimed = claimedItem({
      title: "Custom Title",
      folderName: "Tech",
      folderId: "folder-1",
      feedId: "feed-known",
    });
    const db = withCompleteTransaction(createFakeClaimDb({ claimedRow: claimed }));

    await Effect.runPromise(runItem(db, feeds));

    expect(feeds.calls.subscribeToKnownFeed).toEqual([
      ["user-1", "feed-known", { folderId: "folder-1", customTitle: "Custom Title" }],
    ]);
    expect(feeds.calls.subscribeToFeedUrl).toEqual([]);
    expect(feeds.calls.requestInitialRefresh).toEqual([["feed-1", "user-1"]]);
  });

  test("falls back to subscribing by URL when the item has no known feed", async () => {
    const feeds = feedsLayer();
    const claimed = claimedItem({
      originalUrl: "https://example.com/unknown.xml",
      normalizedUrl: "https://example.com/unknown.xml",
      feedId: null,
    });
    const db = withCompleteTransaction(createFakeClaimDb({ claimedRow: claimed }));

    await Effect.runPromise(runItem(db, feeds));

    expect(feeds.calls.subscribeToFeedUrl).toEqual([
      ["user-1", "https://example.com/unknown.xml", { folderId: null, customTitle: null }],
    ]);
  });

  /** A db whose claim returns `claimed` and which records every later update patch. */
  function createFailingItemDb(claimed: Record<string, unknown>) {
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
    return { db, updateSets };
  }

  test("classifies and durably persists a retryable failure without failing the job", async () => {
    const feeds = feedsLayer({
      subscribeToFeedUrl: () =>
        Effect.fail(
          new InternalError({
            message: "connection reset",
            code: "OPML_FEED_IMPORT_FAILED",
          }),
        ),
    });
    const { db, updateSets } = createFailingItemDb(claimedItem({ attempts: 1 }));
    const logs = recordingLogger();

    await Effect.runPromise(runItem(db, feeds, logs));

    expect(
      updateSets.some(
        (patch) =>
          patch.status === "pending" &&
          patch.leaseToken === null &&
          patch.errorCode === "OPML_FEED_IMPORT_FAILED" &&
          patch.errorMessage === "connection reset",
      ),
    ).toBe(true);
    expect(logs.entries).toContainEqual(
      expect.objectContaining({
        level: "error",
        event: "worker.job.opml_import_item.failed",
        context: expect.objectContaining({ retryable: true, code: "OPML_FEED_IMPORT_FAILED" }),
      }),
    );
  });

  test("fails an item permanently on a non-retryable error", async () => {
    const feeds = feedsLayer({
      subscribeToFeedUrl: () =>
        Effect.fail(new BadRequest({ message: "not a feed", code: "FEED_PARSE_FAILED" })),
    });
    const claimed = claimedItem({ attempts: 1 });
    const updateSets: Array<Record<string, unknown>> = [];
    const db = {
      update: () => ({
        set: (patch: Record<string, unknown>) => {
          updateSets.push(patch);
          return { where: () => ({ returning: () => Promise.resolve([claimed]) }) };
        },
      }),
      select: () => ({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([{ userId: "user-1" }]) }) }),
      }),
      transaction: async (callback: (tx: unknown) => unknown) =>
        callback({
          update: () => ({
            set: (patch: Record<string, unknown>) => {
              updateSets.push(patch);
              return { where: () => ({ returning: () => Promise.resolve([{ id: "item-1" }]) }) };
            },
          }),
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () =>
                  Promise.resolve([
                    {
                      totalItems: 5,
                      subscribedItems: 0,
                      alreadySubscribedItems: 0,
                      failedItems: 1,
                      cancelledItems: 0,
                    },
                  ]),
              }),
            }),
          }),
        }),
    };

    await Effect.runPromise(runItem(db, feeds));

    expect(updateSets).toContainEqual(
      expect.objectContaining({
        status: "failed",
        errorCode: "FEED_PARSE_FAILED",
        errorMessage: "not a feed",
      }),
    );
  });

  test("fails the job when the retry decision itself cannot be persisted", async () => {
    const feeds = feedsLayer({
      subscribeToFeedUrl: () => Effect.fail(new InternalError({ message: "boom" })),
    });
    const claimed = claimedItem({ attempts: 1 });
    const db = {
      update: () => ({
        set: (patch: Record<string, unknown>) => {
          if (patch.status === "processing") {
            return { where: () => ({ returning: () => Promise.resolve([claimed]) }) };
          }
          return { where: () => Promise.reject(new Error("database down")) };
        },
      }),
      select: () => ({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([{ userId: "user-1" }]) }) }),
      }),
    };

    const error = await Effect.runPromise(Effect.flip(runItem(db, feeds)));

    expect(error).toMatchObject({ _tag: "DatabaseError", operation: "opml.item.retry" });
  });
});
