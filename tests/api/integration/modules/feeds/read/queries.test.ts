import { describe, expect, mock, test } from "bun:test";
import { AppError } from "@shared/errors/app";
import { getFeedDetailForUser, listSubscribedFeeds } from "@modules/feeds/read/queries";

describe("feeds read queries", () => {
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
});
