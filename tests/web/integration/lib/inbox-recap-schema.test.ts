import { describe, expect, test } from "vitest";
import { inboxRecapSchema } from "@modules/inbox/services/recap-schema";

describe("inbox recap schema", () => {
  test("accepts folders, top viewed feeds, and oldest saved items", () => {
    const parsed = inboxRecapSchema.parse({
      folders: [
        {
          id: "folder-1",
          name: "Unsorted",
          createdAt: "2026-07-01T00:00:00.000Z",
          feedCount: 2,
        },
      ],
      topViewedFeeds: [
        {
          feedId: "feed-1",
          title: "Example Feed",
          url: "https://example.com/feed.xml",
          siteUrl: "https://example.com",
          faviconUrl: null,
          viewedItemCount: 12,
          lastViewedAt: "2026-07-01T01:00:00.000Z",
          isSubscribed: true,
          folderId: "folder-1",
          folderName: "Unsorted",
        },
      ],
      oldestSavedItems: [
        {
          id: "article-1",
          title: "Saved article",
          link: "https://example.com/article",
          summary: null,
          publishedAt: "2026-06-01T00:00:00.000Z",
          feedId: "feed-1",
          feedUrl: "https://example.com/feed.xml",
          feedSiteUrl: "https://example.com",
          feedTitle: "Example Feed",
          feedFaviconUrl: null,
          isRead: false,
          isSaved: true,
          articleType: "feed",
          savedAt: "2026-06-02T00:00:00.000Z",
        },
      ],
    });

    expect(parsed.topViewedFeeds[0]?.viewedItemCount).toBe(12);
    expect(parsed.oldestSavedItems[0]?.savedAt).toBe("2026-06-02T00:00:00.000Z");
  });
});
