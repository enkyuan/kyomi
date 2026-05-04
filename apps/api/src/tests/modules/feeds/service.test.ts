import { describe, expect, mock, test } from "bun:test";
import { AppError } from "@shared/errors/app-error";
import {
  assertUserSubscribedToFeed,
  bulkMoveFeedsToFolder,
  bulkUnsubscribeFromFeeds,
  getFeedDetailForUser,
  listSubscribedFeeds,
  unsubscribeFromFeed,
  updateFeedSubscriptionSettings,
} from "@modules/feeds/service";

describe("feeds.service", () => {
  test("listSubscribedFeeds maps rows", async () => {
    const createdAt = new Date("2026-03-01T12:00:00.000Z");
    const where = mock(() =>
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
      ]),
    );
    const leftJoin = mock(() => ({ where }));
    const innerJoin = mock(() => ({ leftJoin }));
    const from = mock(() => ({ innerJoin }));
    const select = mock(() => ({ from }));
    const fakeDb = { select } as unknown as Parameters<typeof listSubscribedFeeds>[0];

    const items = await listSubscribedFeeds(fakeDb, "user_1");
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

  test("getFeedDetailForUser includes subscription when present", async () => {
    const feedCreated = new Date("2026-01-01T00:00:00.000Z");
    const subCreated = new Date("2026-01-02T00:00:00.000Z");
    let selectCall = 0;
    const select = mock(() => {
      selectCall += 1;
      if (selectCall === 1) {
        return {
          from: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve([
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
                ]),
            }),
          }),
        };
      }
      return {
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([
                {
                  id: "s1",
                  createdAt: subCreated,
                  customTitle: "Override",
                  isPinned: false,
                  pinnedAt: null,
                },
              ]),
          }),
        }),
      };
    });
    const fakeDb = { select } as unknown as Parameters<typeof getFeedDetailForUser>[0];

    const detail = await getFeedDetailForUser(fakeDb, "u1", "f1");
    expect(detail.isSubscribed).toBe(true);
    expect(detail.subscriptionId).toBe("s1");
    expect(detail.title).toBe("Override");
    expect(detail.customTitle).toBe("Override");
    expect(detail.etag).toBe("etag-1");
    expect(detail.lastModified).toBe("Wed, 21 Oct 2015 07:28:00 GMT");
  });

  test("getFeedDetailForUser throws when feed missing", async () => {
    const select = mock(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }));
    const fakeDb = { select } as unknown as Parameters<typeof getFeedDetailForUser>[0];

    await expect(getFeedDetailForUser(fakeDb, "u1", "missing")).rejects.toBeInstanceOf(AppError);
  });

  test("unsubscribeFromFeed returns message when row deleted", async () => {
    const returning = mock(() => Promise.resolve([{ id: "sub_1" }]));
    const where = mock(() => ({ returning }));
    const del = mock(() => ({ where }));
    const fakeDb = { delete: del } as unknown as Parameters<typeof unsubscribeFromFeed>[0];

    const r = await unsubscribeFromFeed(fakeDb, "u1", "f1");
    expect(r.message).toBe("Unsubscribed successfully");
  });

  test("unsubscribeFromFeed throws when nothing deleted", async () => {
    const returning = mock(() => Promise.resolve([]));
    const where = mock(() => ({ returning }));
    const del = mock(() => ({ where }));
    const fakeDb = { delete: del } as unknown as Parameters<typeof unsubscribeFromFeed>[0];

    await expect(unsubscribeFromFeed(fakeDb, "u1", "f1")).rejects.toBeInstanceOf(AppError);
  });

  test("bulkUnsubscribeFromFeeds deletes matching ids", async () => {
    const returning = mock(() => Promise.resolve([{ id: "a" }, { id: "b" }]));
    const where = mock(() => ({ returning }));
    const del = mock(() => ({ where }));
    const fakeDb = { delete: del } as unknown as Parameters<typeof bulkUnsubscribeFromFeeds>[0];

    const r = await bulkUnsubscribeFromFeeds(fakeDb, "u1", [
      "550e8400-e29b-41d4-a716-446655440000",
      "550e8400-e29b-41d4-a716-446655440001",
    ]);
    expect(r.removedCount).toBe(2);
  });

  test("bulkUnsubscribeFromFeeds rejects empty id list", async () => {
    const fakeDb = {} as Parameters<typeof bulkUnsubscribeFromFeeds>[0];
    await expect(bulkUnsubscribeFromFeeds(fakeDb, "u1", [])).rejects.toBeInstanceOf(AppError);
  });

  test("bulkMoveFeedsToFolder updates matching subscriptions", async () => {
    let selectCall = 0;
    const select = mock(() => {
      selectCall += 1;
      return {
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ id: "folder_1" }]),
          }),
        }),
      };
    });
    const returning = mock(() => Promise.resolve([{ id: "a" }]));
    const where = mock(() => ({ returning }));
    const set = mock(() => ({ where }));
    const update = mock(() => ({ set }));
    const fakeDb = { select, update } as unknown as Parameters<typeof bulkMoveFeedsToFolder>[0];

    const r = await bulkMoveFeedsToFolder(
      fakeDb,
      "u1",
      ["550e8400-e29b-41d4-a716-446655440000"],
      "550e8400-e29b-41d4-a716-446655440001",
    );
    expect(r.updatedCount).toBe(1);
    expect(selectCall).toBe(1);
  });

  test("updateFeedSubscriptionSettings updates when subscription exists", async () => {
    const returning = mock(() => Promise.resolve([{ id: "s1" }]));
    const where = mock(() => ({ returning }));
    const set = mock(() => ({ where }));
    const update = mock(() => ({ set }));
    const fakeDb = { update } as unknown as Parameters<typeof updateFeedSubscriptionSettings>[0];

    const r = await updateFeedSubscriptionSettings(fakeDb, "u1", "f1", { customTitle: "X" });
    expect(r.message).toBe("Feed settings updated successfully");
  });

  test("updateFeedSubscriptionSettings sets pinnedAt when pinning", async () => {
    const returning = mock(() => Promise.resolve([{ id: "s1" }]));
    const where = mock(() => ({ returning }));
    const set = mock(() => ({ where }));
    const update = mock(() => ({ set }));
    const fakeDb = { update } as unknown as Parameters<typeof updateFeedSubscriptionSettings>[0];

    const r = await updateFeedSubscriptionSettings(fakeDb, "u1", "f1", { isPinned: true });
    expect(r.message).toBe("Feed settings updated successfully");
    expect(set).toHaveBeenCalled();
    const firstSetArg = (set as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0];
    expect(firstSetArg).toEqual(
      expect.objectContaining({
        isPinned: true,
        pinnedAt: expect.any(Date),
      }),
    );
  });

  test("updateFeedSubscriptionSettings throws when no fields", async () => {
    const fakeDb = {} as Parameters<typeof updateFeedSubscriptionSettings>[0];
    await expect(updateFeedSubscriptionSettings(fakeDb, "u1", "f1", {})).rejects.toBeInstanceOf(
      AppError,
    );
  });

  test("assertUserSubscribedToFeed throws when missing", async () => {
    const select = mock(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }));
    const fakeDb = { select } as unknown as Parameters<typeof assertUserSubscribedToFeed>[0];

    await expect(assertUserSubscribedToFeed(fakeDb, "u1", "f1")).rejects.toBeInstanceOf(AppError);
  });
});
