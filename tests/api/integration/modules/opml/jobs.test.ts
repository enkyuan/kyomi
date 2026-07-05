import { describe, expect, mock, test } from "bun:test";

const createOrSubscribeToFeedMock = mock(async () => ({
  feedId: "feed-1",
  subscriptionId: "sub-1",
  newFeed: true,
  newSubscription: true,
}));
const enqueueFeedRefreshMock = mock(async () => ({ jobId: "job-1" }));
const recordOpmlTaskSuccessMock = mock(async () => undefined);

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
