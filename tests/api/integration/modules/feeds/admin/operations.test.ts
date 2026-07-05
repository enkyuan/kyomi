import { describe, expect, mock, test } from "bun:test";
import { adminUpdateGlobalFeed } from "@modules/feeds/admin/operations";

describe("adminUpdateGlobalFeed", () => {
  test("throws EMPTY_UPDATE when no fields", async () => {
    const fakeDb = {} as unknown as Parameters<typeof adminUpdateGlobalFeed>[0];
    await expect(adminUpdateGlobalFeed(fakeDb, "feed_1", {})).rejects.toMatchObject({
      code: "EMPTY_UPDATE",
    });
  });

  test("throws FEED_NOT_FOUND when feed row missing", async () => {
    const select = mock(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }));
    const fakeDb = { select } as unknown as Parameters<typeof adminUpdateGlobalFeed>[0];
    await expect(adminUpdateGlobalFeed(fakeDb, "missing", { title: "New" })).rejects.toMatchObject({
      code: "FEED_NOT_FOUND",
    });
  });
});
