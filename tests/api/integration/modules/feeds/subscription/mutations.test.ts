import { describe, expect, mock, test } from "bun:test";
import { AppError } from "@shared/errors/app";
import {
  assertUserSubscribedToFeed,
  bulkMoveFeedsToFolder,
  bulkUnsubscribeFromFeeds,
  unsubscribeFromFeed,
  updateFeedSubscriptionSettings,
} from "@modules/feeds/subscription/mutations";

describe("feeds.subscription.mutations", () => {
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
