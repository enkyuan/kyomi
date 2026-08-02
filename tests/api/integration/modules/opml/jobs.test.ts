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

mock.module("@modules/feeds/subscription/subscribe", () => ({
  createOrSubscribeToFeed: createOrSubscribeToFeedMock,
  subscribeToExistingFeed: mock(async () => ({
    feedId: "feed-1",
    subscriptionId: "sub-1",
    newFeed: false,
    newSubscription: false,
  })),
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
