import { describe, expect, mock, test } from "bun:test";

const createOrSubscribeToFeedMock = mock(async () => ({
  feedId: "feed-1",
  subscriptionId: "sub-1",
  newFeed: true,
  newSubscription: true,
}));
const enqueueFeedRefreshMock = mock(async () => ({ jobId: "job-1" }));
const recordOpmlTaskSuccessMock = mock(async () => undefined);
const publishJobMock = mock(async () => "stream-id-1");
const createOpmlImportMock = mock(async (_db: unknown, input: { userId: string }) => ({
  id: "import-1",
  userId: input.userId,
  status: "accepted",
}));
const recordOpmlImportPrepareWakeupMock = mock(async () => undefined);
const claimOpmlPreparationMock = mock(
  async (_db: unknown, importId: string) =>
    ({
      importId,
      userId: "user-1",
      filename: "feeds.opml",
      sourceXml: '<opml><body><outline xmlUrl="https://example.com/feed.xml"/></body></opml>',
    }) as { importId: string; userId: string; filename: string; sourceXml: string } | null,
);
const insertOpmlImportItemsCalls: unknown[][] = [];
const insertOpmlImportItemsMock = mock(async (...args: unknown[]) => {
  insertOpmlImportItemsCalls.push(args);
  return (args[2] as unknown[]).length;
});
const recordOpmlPreparationHeartbeatMock = mock(async () => undefined);
const recordOpmlImportMaterializedMock = mock(async () => undefined);
const finalizeOpmlImportPreparationMock = mock(async () => undefined);
const failOpmlImportPreparationMock = mock(async () => undefined);
const matchKnownFeedsForImportMock = mock(async () => 0);
const subscribeKnownOpmlItemsMock = mock(async () => ({
  processed: 0,
  subscribed: 0,
  alreadySubscribed: 0,
  refreshCandidateFeedIds: [] as string[],
}));
const publishKnownFeedRefreshCandidatesMock = mock(async () => undefined);

mock.module("@modules/feeds/subscription/subscribe", () => ({
  createOrSubscribeToFeed: createOrSubscribeToFeedMock,
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
mock.module("@modules/opml/store", () => ({
  createOpmlImport: createOpmlImportMock,
  recordOpmlImportPrepareWakeup: recordOpmlImportPrepareWakeupMock,
  claimOpmlPreparation: claimOpmlPreparationMock,
  insertOpmlImportItems: insertOpmlImportItemsMock,
  recordOpmlImportMaterialized: recordOpmlImportMaterializedMock,
  recordOpmlPreparationHeartbeat: recordOpmlPreparationHeartbeatMock,
  finalizeOpmlImportPreparation: finalizeOpmlImportPreparationMock,
  failOpmlImportPreparation: failOpmlImportPreparationMock,
}));
mock.module("@modules/opml/known-feeds", () => ({
  matchKnownFeedsForImport: matchKnownFeedsForImportMock,
  subscribeKnownOpmlItems: subscribeKnownOpmlItemsMock,
  publishKnownFeedRefreshCandidates: publishKnownFeedRefreshCandidatesMock,
}));
mock.module("@adapters/queue/publish-job", () => ({
  publishJob: publishJobMock,
}));
mock.module("@adapters/redis", () => ({
  getRedis: mock(() => ({})),
}));

describe("enqueueOpmlImport", () => {
  test("creates the durable import row and publishes an ID-only prepare wakeup", async () => {
    const { enqueueOpmlImport } = await import("@modules/opml/jobs");
    const logger = {
      info: mock(() => undefined),
      warn: mock(() => undefined),
      error: mock(() => undefined),
    };

    const result = await enqueueOpmlImport(
      {} as never,
      "user-1",
      '<opml><body><outline xmlUrl="https://example.com/feed.xml"/></body></opml>',
      logger,
      "feeds.opml",
    );

    expect(result).toEqual({ taskId: "import-1" });
    expect(createOpmlImportMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ userId: "user-1", filename: "feeds.opml" }),
    );
    expect(publishJobMock).toHaveBeenCalledWith(
      {},
      { type: "opml.import.prepare", payload: { importId: "import-1" } },
    );
    expect(recordOpmlImportPrepareWakeupMock).toHaveBeenCalledWith({}, "import-1");
  });

  test("still returns the taskId when publishing the prepare wakeup fails", async () => {
    publishJobMock.mockImplementationOnce(async () => {
      throw new Error("redis unavailable");
    });
    const { enqueueOpmlImport } = await import("@modules/opml/jobs");
    const logger = {
      info: mock(() => undefined),
      warn: mock(() => undefined),
      error: mock(() => undefined),
    };

    const result = await enqueueOpmlImport({} as never, "user-1", "<opml></opml>", logger);

    expect(result).toEqual({ taskId: "import-1" });
    expect(logger.error).toHaveBeenCalledWith(
      "opml.import.prepare.delivery_pending",
      expect.objectContaining({ userId: "user-1", taskId: "import-1" }),
    );
  });
});

describe("runOpmlImportFeedJob", () => {
  test("enqueues a first refresh for newly imported subscriptions", async () => {
    const { runOpmlImportFeedJob } = await import("@modules/opml/jobs");
    const logger = {
      info: mock(() => undefined),
      warn: mock(() => undefined),
      error: mock(() => undefined),
    };

    await runOpmlImportFeedJob(
      {} as never,
      {
        taskId: "task-1",
        userId: "user-1",
        url: "https://example.com/feed.xml",
        title: "Example",
        folderId: null,
      },
      logger,
    );

    expect(enqueueFeedRefreshMock).toHaveBeenCalledWith(
      {},
      "feed-1",
      "user-1",
      "subscription_created",
      logger,
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

  test("materializes items in chunks of at most 500 and finalizes once", async () => {
    insertOpmlImportItemsCalls.length = 0;
    claimOpmlPreparationMock.mockImplementationOnce(async (_db: unknown, importId: string) => ({
      importId,
      userId: "user-1",
      filename: "feeds.opml",
      sourceXml: buildOpmlWithFeedCount(1201),
    }));
    const { runOpmlImportPrepareJob } = await import("@modules/opml/jobs");
    const logger = {
      info: mock(() => undefined),
      warn: mock(() => undefined),
      error: mock(() => undefined),
    };

    await runOpmlImportPrepareJob({} as never, { importId: "import-1" }, logger);

    expect(insertOpmlImportItemsCalls).toHaveLength(1);
    const feedsArg = insertOpmlImportItemsCalls[0]?.[2] as unknown[];
    expect(feedsArg).toHaveLength(1201);
    expect(recordOpmlImportMaterializedMock).toHaveBeenCalledWith(
      {},
      "import-1",
      expect.objectContaining({ totalItems: 1201 }),
    );
    expect(matchKnownFeedsForImportMock).toHaveBeenCalledWith({}, "import-1");
    expect(finalizeOpmlImportPreparationMock).toHaveBeenCalledWith({}, "import-1");
    expect(failOpmlImportPreparationMock).not.toHaveBeenCalled();
  });

  test("performs no work for a duplicate or missing prepare wakeup", async () => {
    insertOpmlImportItemsMock.mockClear();
    finalizeOpmlImportPreparationMock.mockClear();
    claimOpmlPreparationMock.mockImplementationOnce(async () => null);
    const { runOpmlImportPrepareJob } = await import("@modules/opml/jobs");
    const logger = {
      info: mock(() => undefined),
      warn: mock(() => undefined),
      error: mock(() => undefined),
    };

    await runOpmlImportPrepareJob({} as never, { importId: "import-1" }, logger);

    expect(insertOpmlImportItemsMock).not.toHaveBeenCalled();
    expect(finalizeOpmlImportPreparationMock).not.toHaveBeenCalled();
  });

  test("fails the import on invalid XML without throwing", async () => {
    claimOpmlPreparationMock.mockImplementationOnce(async (_db: unknown, importId: string) => ({
      importId,
      userId: "user-1",
      filename: "feeds.opml",
      sourceXml: "<opml><body></body></opml>",
    }));
    const { runOpmlImportPrepareJob } = await import("@modules/opml/jobs");
    const logger = {
      info: mock(() => undefined),
      warn: mock(() => undefined),
      error: mock(() => undefined),
    };

    await runOpmlImportPrepareJob({} as never, { importId: "import-1" }, logger);

    expect(failOpmlImportPreparationMock).toHaveBeenCalledWith(
      {},
      "import-1",
      expect.objectContaining({ code: "OPML_NO_FEEDS" }),
    );
  });

  test("rethrows platform errors so the queue retries instead of failing the import", async () => {
    failOpmlImportPreparationMock.mockClear();
    claimOpmlPreparationMock.mockImplementationOnce(async (_db: unknown, importId: string) => ({
      importId,
      userId: "user-1",
      filename: "feeds.opml",
      sourceXml: buildOpmlWithFeedCount(5),
    }));
    insertOpmlImportItemsMock.mockImplementationOnce(async () => {
      throw new Error("connection reset");
    });
    const { runOpmlImportPrepareJob } = await import("@modules/opml/jobs");
    const logger = {
      info: mock(() => undefined),
      warn: mock(() => undefined),
      error: mock(() => undefined),
    };

    await expect(
      runOpmlImportPrepareJob({} as never, { importId: "import-1" }, logger),
    ).rejects.toThrow("connection reset");
    expect(failOpmlImportPreparationMock).not.toHaveBeenCalled();
  });

  test("drains known-feed matches in a loop and publishes refresh candidates before finalizing", async () => {
    subscribeKnownOpmlItemsMock.mockClear();
    publishKnownFeedRefreshCandidatesMock.mockClear();
    claimOpmlPreparationMock.mockImplementationOnce(async (_db: unknown, importId: string) => ({
      importId,
      userId: "user-1",
      filename: "feeds.opml",
      sourceXml: buildOpmlWithFeedCount(5),
    }));
    matchKnownFeedsForImportMock.mockImplementationOnce(async () => 5);
    subscribeKnownOpmlItemsMock
      .mockImplementationOnce(async () => ({
        processed: 3,
        subscribed: 2,
        alreadySubscribed: 1,
        refreshCandidateFeedIds: ["feed-1", "feed-2"],
      }))
      .mockImplementationOnce(async () => ({
        processed: 0,
        subscribed: 0,
        alreadySubscribed: 0,
        refreshCandidateFeedIds: [],
      }));
    const { runOpmlImportPrepareJob } = await import("@modules/opml/jobs");
    const logger = {
      info: mock(() => undefined),
      warn: mock(() => undefined),
      error: mock(() => undefined),
    };

    await runOpmlImportPrepareJob({} as never, { importId: "import-1" }, logger);

    expect(subscribeKnownOpmlItemsMock).toHaveBeenCalledTimes(2);
    expect(publishKnownFeedRefreshCandidatesMock).toHaveBeenCalledWith(
      {},
      "user-1",
      ["feed-1", "feed-2"],
      logger,
    );
    expect(finalizeOpmlImportPreparationMock).toHaveBeenCalledWith({}, "import-1");
  });
});
