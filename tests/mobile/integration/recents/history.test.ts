import { describe, expect, test } from "bun:test";
import {
  MAX_RECENT_ARTICLES,
  parseRecentArticles,
  recordRecentArticle,
} from "../../../../apps/mobile/src/modules/recents/lib/history";
import type { RecentArticle } from "../../../../apps/mobile/src/modules/recents/lib/history";
import type { ArticleListItemDto } from "@kyomi/reader/schemas/article";

const article = (id: string, articleType: "feed" | "clip" = "feed"): ArticleListItemDto => ({
  articleType,
  categories: [],
  feedFaviconUrl: null,
  feedId: "feed-id",
  feedSiteUrl: "https://example.com",
  feedTitle: "Example",
  feedUrl: "https://example.com/feed.xml",
  id,
  isRead: false,
  isSaved: false,
  lastViewedAt: null,
  link: `https://example.com/${id}`,
  publishedAt: "2026-08-05T12:00:00.000Z",
  summary: null,
  title: `Article ${id}`,
});

describe("recent article history", () => {
  test("moves a revisited feed item to the front with its latest view time", () => {
    const first = article("first");
    const second = article("second");
    const initial = recordRecentArticle([], first, "2026-08-05T12:00:00.000Z");
    const withSecond = recordRecentArticle(initial, second, "2026-08-05T12:01:00.000Z");
    const revisited = recordRecentArticle(withSecond, first, "2026-08-05T12:02:00.000Z");

    expect(revisited.map((item) => item.id)).toEqual(["first", "second"]);
    expect(revisited[0]?.viewedAt).toBe("2026-08-05T12:02:00.000Z");
  });

  test("keeps clips out of feed-item history and caps stored entries", () => {
    const original = recordRecentArticle([], article("existing"), "2026-08-05T12:00:00.000Z");

    expect(
      recordRecentArticle(original, article("clip", "clip"), "2026-08-05T12:01:00.000Z"),
    ).toEqual(original);

    const capped = Array.from({ length: MAX_RECENT_ARTICLES + 1 }, (_, index) => index).reduce<
      RecentArticle[]
    >(
      (history, index) =>
        recordRecentArticle(history, article(String(index)), "2026-08-05T12:01:00.000Z"),
      [],
    );

    expect(capped).toHaveLength(MAX_RECENT_ARTICLES);
    expect(capped[0]?.id).toBe(String(MAX_RECENT_ARTICLES));
  });

  test("rejects malformed persisted history without discarding valid records", () => {
    expect(parseRecentArticles("not-json")).toEqual([]);
    expect(
      parseRecentArticles(
        JSON.stringify([
          { id: "missing-fields" },
          {
            feedFaviconUrl: null,
            feedSiteUrl: null,
            feedTitle: "Example",
            feedUrl: null,
            id: "valid",
            link: "https://example.com/valid",
            title: "Valid",
            viewedAt: "2026-08-05T12:00:00.000Z",
          },
        ]),
      ),
    ).toMatchObject([{ id: "valid" }]);
  });
});
