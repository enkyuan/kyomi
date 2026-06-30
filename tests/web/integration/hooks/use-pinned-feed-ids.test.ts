import { describe, expect, test } from "vitest";
import {
  applyPinnedState,
  buildMigrationKey,
  buildMigrationStartedKey,
  sortPinnedFeeds,
} from "@modules/feeds";

describe("usePinnedFeedIds helpers", () => {
  test("builds stable migration keys scoped by user", () => {
    expect(buildMigrationKey("user-1")).toBe("kyomi:pinned-feed-ids:migrated:v1:user-1");
    expect(buildMigrationStartedKey("user-1")).toBe(
      "kyomi:pinned-feed-ids:migration-started:v1:user-1",
    );
  });

  test("applyPinnedState updates target feed only", () => {
    const feeds = [
      {
        subscriptionId: "s1",
        feedId: "f1",
        url: "https://a.example/feed.xml",
        title: "A",
        customTitle: null,
        link: "https://a.example",
        faviconUrl: null,
        faviconSource: null,
        refreshStatus: "idle",
        isPinned: false,
        pinnedAt: null,
        folderId: null,
        folderName: null,
        subscribedAt: "2026-04-18T11:00:00.000Z",
      },
      {
        subscriptionId: "s2",
        feedId: "f2",
        url: "https://b.example/feed.xml",
        title: "B",
        customTitle: null,
        link: "https://b.example",
        faviconUrl: null,
        faviconSource: null,
        refreshStatus: "idle",
        isPinned: false,
        pinnedAt: null,
        folderId: null,
        folderName: null,
        subscribedAt: "2026-04-18T11:00:00.000Z",
      },
    ];

    const updated = applyPinnedState(feeds, "f2", true);
    expect(updated?.find((f) => f.feedId === "f1")?.isPinned).toBe(false);
    expect(updated?.find((f) => f.feedId === "f2")?.isPinned).toBe(true);
  });

  test("sorts pinned feeds by pinnedAt descending", () => {
    const sorted = sortPinnedFeeds([
      {
        subscriptionId: "s1",
        feedId: "f1",
        url: "https://a.example/feed.xml",
        title: "A",
        customTitle: null,
        link: "https://a.example",
        faviconUrl: null,
        faviconSource: null,
        refreshStatus: "idle",
        isPinned: true,
        pinnedAt: "2026-04-18T10:00:00.000Z",
        folderId: null,
        folderName: null,
        subscribedAt: "2026-04-18T09:00:00.000Z",
      },
      {
        subscriptionId: "s2",
        feedId: "f2",
        url: "https://b.example/feed.xml",
        title: "B",
        customTitle: null,
        link: "https://b.example",
        faviconUrl: null,
        faviconSource: null,
        refreshStatus: "idle",
        isPinned: true,
        pinnedAt: "2026-04-18T12:00:00.000Z",
        folderId: null,
        folderName: null,
        subscribedAt: "2026-04-18T09:00:00.000Z",
      },
    ]);

    expect(sorted.map((f) => f.feedId)).toEqual(["f2", "f1"]);
  });
});
