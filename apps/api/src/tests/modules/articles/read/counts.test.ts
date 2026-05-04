import { describe, expect, mock, test } from "bun:test";
import { getArticleCountsForUser } from "@modules/articles/read/counts";

function createFakeDb(results: { unread: number; all: number; saved: number; clipSaved?: number }) {
  let selectCall = 0;
  const select = mock(() => {
    selectCall += 1;
    const currentCall = selectCall;

    const returnCount = (count: number) => Promise.resolve([{ c: count }]);

    if (currentCall === 1) {
      // unread
      return {
        from: () => ({
          innerJoin: () => ({
            leftJoin: () => ({
              where: () => returnCount(results.unread),
            }),
          }),
        }),
      };
    }
    if (currentCall === 2) {
      // all
      return {
        from: () => ({
          innerJoin: () => ({
            leftJoin: () => ({
              where: () => returnCount(results.all),
            }),
          }),
        }),
      };
    }
    if (currentCall === 3) {
      // saved
      return {
        from: () => ({
          innerJoin: () => ({
            leftJoin: () => ({
              where: () => returnCount(results.saved),
            }),
          }),
        }),
      };
    }
    if (currentCall === 4) {
      // clipSaved
      return {
        from: () => ({
          where: () => returnCount(results.clipSaved ?? 0),
        }),
      };
    }
  });

  return { select, getSelectCallCount: () => selectCall } as unknown as Parameters<
    typeof getArticleCountsForUser
  >[0] & { getSelectCallCount: () => number };
}

describe("getArticleCountsForUser", () => {
  test("returns unmerged all and unread counts, and merged saved count when unscoped", async () => {
    const fakeDb = createFakeDb({
      unread: 5,
      all: 10,
      saved: 3,
      clipSaved: 2,
    });

    const result = await getArticleCountsForUser(fakeDb, "user_1");

    expect(fakeDb.getSelectCallCount()).toBe(4);
    expect(result).toEqual({
      all: 10,
      unread: 5,
      saved: 5, // 3 feed saved + 2 clip saved
    });
  });

  test("does not query or merge clip counts when scoped by feedId", async () => {
    const fakeDb = createFakeDb({
      unread: 1,
      all: 2,
      saved: 1,
    });

    const result = await getArticleCountsForUser(fakeDb, "user_1", { feedId: "feed_1" });

    expect(fakeDb.getSelectCallCount()).toBe(3); // No 4th query for clips
    expect(result).toEqual({
      all: 2,
      unread: 1,
      saved: 1,
    });
  });

  test("does not query or merge clip counts when scoped by folderId", async () => {
    const fakeDb = createFakeDb({
      unread: 4,
      all: 8,
      saved: 2,
    });

    const result = await getArticleCountsForUser(fakeDb, "user_1", { folderId: "folder_1" });

    expect(fakeDb.getSelectCallCount()).toBe(3); // No 4th query for clips
    expect(result).toEqual({
      all: 8,
      unread: 4,
      saved: 2,
    });
  });
});
