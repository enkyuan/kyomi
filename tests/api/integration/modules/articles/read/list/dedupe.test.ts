import { describe, expect, test } from "bun:test";
import {
  collapseObviousDuplicates,
  normalizedArticleIdentity,
} from "@modules/articles/read/list/dedupe";
import { filterVisibleArticleRowsForTest } from "@modules/articles/read/list";

type Row = {
  id: string;
  title: string;
  canonicalUrl: string;
  link: string;
  summary: string | null;
  publishedAt: Date;
  feedId: string;
  feedUrl: string | null;
  feedSiteUrl: string | null;
  feedTitle: string;
  feedFaviconUrl: string | null;
  isRead: boolean;
  isSaved: boolean;
  hiddenAt: Date | null;
};

function row(overrides: Partial<Row>): Row {
  return {
    id: "a",
    title: "Title",
    canonicalUrl: "https://example.com/post",
    link: "https://example.com/post",
    summary: null,
    publishedAt: new Date("2026-04-01T00:00:00.000Z"),
    feedId: "feed-1",
    feedUrl: "https://example.com/feed.xml",
    feedSiteUrl: "https://example.com",
    feedTitle: "Feed",
    feedFaviconUrl: null,
    isRead: false,
    isSaved: false,
    hiddenAt: null,
    ...overrides,
  };
}

describe("articles.list duplicate collapse", () => {
  test("normalizes tracking params/hash/trailing slash for identity", () => {
    const normalized = normalizedArticleIdentity(
      "https://Example.com/post/?utm_source=x&fbclid=abc#section",
    );
    expect(normalized).toBe("https://example.com/post");
  });

  test("collapses obvious same-feed duplicates and keeps richer row", () => {
    const rows = [
      row({
        id: "1",
        link: "https://example.com/post?utm_source=mail",
        summary: null,
      }),
      row({
        id: "2",
        link: "https://example.com/post",
        summary: "Richer summary",
      }),
    ];

    const deduped = collapseObviousDuplicates(rows);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("2");
    expect(deduped[0]?.summary).toBe("Richer summary");
  });

  test("does not collapse across different feeds", () => {
    const rows = [
      row({ id: "1", feedId: "feed-1", link: "https://example.com/post" }),
      row({ id: "2", feedId: "feed-2", link: "https://example.com/post" }),
    ];

    const deduped = collapseObviousDuplicates(rows);
    expect(deduped).toHaveLength(2);
  });

  test("prefers persisted canonical identity over link text", () => {
    const rows = [
      row({
        id: "1",
        canonicalUrl: "https://example.com/post",
        link: "https://example.com/post?utm_source=a",
      }),
      row({
        id: "2",
        canonicalUrl: "https://example.com/post",
        link: "https://example.com/post?utm_source=b",
        summary: "richer",
      }),
    ];

    const deduped = collapseObviousDuplicates(rows);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("2");
  });

  test("excludes hidden feed rows before pagination", () => {
    const rows = [
      row({ id: "visible", title: "Visible", hiddenAt: null }),
      row({ id: "hidden", title: "Hidden", hiddenAt: new Date("2026-07-01T00:00:00.000Z") }),
    ];

    expect(filterVisibleArticleRowsForTest(rows).map((candidate) => candidate.id)).toEqual([
      "visible",
    ]);
  });
});
