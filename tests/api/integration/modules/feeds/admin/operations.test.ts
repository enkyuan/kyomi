import { afterEach, describe, expect, mock, test } from "bun:test";
import { env } from "@config/env";
import { adminDeleteGlobalFeed, adminUpdateGlobalFeed } from "@modules/feeds/admin/operations";

function silentLogger() {
  return { info: mock(() => undefined), warn: mock(() => undefined), error: mock(() => undefined) };
}

describe("adminUpdateGlobalFeed", () => {
  test("throws EMPTY_UPDATE when no fields", async () => {
    const fakeDb = {} as unknown as Parameters<typeof adminUpdateGlobalFeed>[0];
    await expect(adminUpdateGlobalFeed(fakeDb, "feed_1", {}, silentLogger())).rejects.toMatchObject(
      {
        code: "EMPTY_UPDATE",
      },
    );
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
    await expect(
      adminUpdateGlobalFeed(fakeDb, "missing", { title: "New" }, silentLogger()),
    ).rejects.toMatchObject({
      code: "FEED_NOT_FOUND",
    });
  });
});

describe("search index sync", () => {
  const mutableEnv = env as { MEILI_URL: string | undefined };
  const originalMeiliUrl = env.MEILI_URL;
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    mutableEnv.MEILI_URL = originalMeiliUrl;
    globalThis.fetch = originalFetch;
  });

  const feedRow = {
    id: "feed_1",
    url: "https://example.com/feed.xml",
    title: "Example",
    description: null,
    link: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  };

  function fakeAdminDb() {
    return {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [feedRow] }) }) }),
      update: () => ({ set: () => ({ where: () => ({ returning: async () => [feedRow] }) }) }),
      delete: () => ({ where: () => ({ returning: async () => [{ id: "feed_1" }] }) }),
    } as never;
  }

  test("an index failure after an update is logged, not swallowed, and the update still succeeds", async () => {
    mutableEnv.MEILI_URL = "http://meili.local";
    globalThis.fetch = mock(async () => new Response("down", { status: 503 })) as never;
    const logger = silentLogger();

    const detail = await adminUpdateGlobalFeed(
      fakeAdminDb(),
      "feed_1",
      { title: "Example" },
      logger,
    );

    expect(detail.id).toBe("feed_1");
    expect(logger.warn).toHaveBeenCalledWith(
      "feeds.admin.search_sync_failed",
      expect.objectContaining({ operation: "upsert", feedId: "feed_1" }),
    );
  });

  test("an index failure after a delete is logged", async () => {
    mutableEnv.MEILI_URL = "http://meili.local";
    globalThis.fetch = mock(async () => new Response("down", { status: 503 })) as never;
    const logger = silentLogger();

    await adminDeleteGlobalFeed(fakeAdminDb(), "feed_1", logger);

    expect(logger.warn).toHaveBeenCalledWith(
      "feeds.admin.search_sync_failed",
      expect.objectContaining({ operation: "delete", feedId: "feed_1" }),
    );
  });
});
