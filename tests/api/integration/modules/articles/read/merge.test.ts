import { describe, expect, test } from "bun:test";
import { mergeArticleItemsByDate } from "@modules/articles/read/merge";
import type { ArticleListItemDto } from "@modules/articles/types";

const feed = (id: string, at: string): ArticleListItemDto => ({
  id,
  title: "t",
  link: "https://x",
  summary: null,
  publishedAt: at,
  feedId: "f1",
  feedTitle: "F",
  feedFaviconUrl: null,
  isRead: false,
  isSaved: false,
  articleType: "feed",
});

describe("mergeArticleItemsByDate", () => {
  test("orders newest first and caps limit", () => {
    const merged = mergeArticleItemsByDate(
      [
        [feed("a", "2024-01-01T00:00:00.000Z"), feed("b", "2024-06-01T00:00:00.000Z")],
        [feed("c", "2024-03-01T00:00:00.000Z")],
      ],
      2,
    );
    expect(merged.map((x) => x.id)).toEqual(["b", "c"]);
  });
});
