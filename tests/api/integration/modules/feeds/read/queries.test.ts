import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { getFeedDetailForUser, listSubscribedFeeds } from "@modules/feeds/read/queries";
import { fakeDb, recordingLogger } from "@api-tests/support/layers";

/** A db whose successive `select(...)` calls resolve to `results`, each through `from().where().limit()`. */
function selectSequence(...results: unknown[][]) {
  let call = 0;
  const chain = (rows: unknown[]) => ({
    from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }),
  });
  return { select: () => chain(results[call++] ?? []) };
}

const failureOf = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(Effect.flip(effect));

describe("feeds read queries", () => {
  test("listSubscribedFeeds maps rows", async () => {
    const createdAt = new Date("2026-03-01T12:00:00.000Z");
    const where = () =>
      Promise.resolve([
        {
          subscriptionId: "sub_1",
          feedId: "feed_1",
          url: "https://ex.com/atom",
          feedTitle: "Example",
          customTitle: null as string | null,
          link: "https://ex.com/" as string | null,
          faviconUrl: null as string | null,
          faviconSource: null as string | null,
          refreshStatus: "idle",
          isPinned: false,
          pinnedAt: null as Date | null,
          folderId: "folder_1" as string | null,
          folderName: "Unsorted" as string | null,
          subscribedAt: createdAt,
        },
      ]);
    const db = fakeDb({
      select: () => ({
        from: () => ({ innerJoin: () => ({ leftJoin: () => ({ where }) }) }),
      }),
    });

    const items = await Effect.runPromise(listSubscribedFeeds("user_1").pipe(Effect.provide(db)));

    expect(items).toEqual([
      {
        subscriptionId: "sub_1",
        feedId: "feed_1",
        url: "https://ex.com/atom",
        title: "Example",
        customTitle: null,
        link: "https://ex.com/",
        faviconUrl: null,
        faviconSource: null,
        refreshStatus: "idle",
        isPinned: false,
        pinnedAt: null,
        folderId: "folder_1",
        folderName: "Unsorted",
        subscribedAt: "2026-03-01T12:00:00.000Z",
      },
    ]);
  });

  test("a failing query is a typed DatabaseError", async () => {
    const db = fakeDb({
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            leftJoin: () => ({ where: () => Promise.reject(new Error("connection reset")) }),
          }),
        }),
      }),
    });

    const error = await failureOf(listSubscribedFeeds("user_1").pipe(Effect.provide(db)));

    expect(error).toMatchObject({ _tag: "DatabaseError", operation: "feeds.list_subscribed" });
  });

  test("getFeedDetailForUser includes subscription when present", async () => {
    const feedCreated = new Date("2026-01-01T00:00:00.000Z");
    const subCreated = new Date("2026-01-02T00:00:00.000Z");
    const db = fakeDb(
      selectSequence(
        [
          {
            id: "f1",
            url: "https://u",
            title: "T",
            description: "D",
            link: "https://l",
            faviconUrl: null,
            faviconSource: null,
            faviconFetchedAt: null,
            createdAt: feedCreated,
            updatedAt: feedCreated,
            refreshStatus: "idle",
            lastRefreshStartedAt: null,
            lastRefreshCompletedAt: null,
            lastRefreshFailedAt: null,
            lastRefreshError: null,
            etag: "etag-1",
            lastModified: "Wed, 21 Oct 2015 07:28:00 GMT",
            nextRefreshAt: null,
          },
        ],
        [
          {
            id: "s1",
            createdAt: subCreated,
            customTitle: "Override",
            isPinned: false,
            pinnedAt: null,
          },
        ],
      ),
    );
    const logs = recordingLogger();

    const detail = await Effect.runPromise(
      getFeedDetailForUser("u1", "f1").pipe(Effect.provide(Layer.mergeAll(db, logs.layer))),
    );

    expect(detail.isSubscribed).toBe(true);
    expect(detail.subscriptionId).toBe("s1");
    expect(detail.title).toBe("Override");
    expect(detail.customTitle).toBe("Override");
    expect(detail.etag).toBe("etag-1");
    expect(detail.lastModified).toBe("Wed, 21 Oct 2015 07:28:00 GMT");
    expect(logs.entries).toEqual([
      {
        level: "info",
        event: "feeds.detail",
        context: { userId: "u1", feedId: "f1", isSubscribed: true },
      },
    ]);
  });

  test("getFeedDetailForUser fails with FEED_NOT_FOUND when the feed is missing", async () => {
    const db = fakeDb(selectSequence([]));

    const error = await failureOf(
      getFeedDetailForUser("u1", "missing").pipe(
        Effect.provide(Layer.mergeAll(db, recordingLogger().layer)),
      ),
    );

    expect(error).toMatchObject({ _tag: "NotFound", code: "FEED_NOT_FOUND" });
  });
});
