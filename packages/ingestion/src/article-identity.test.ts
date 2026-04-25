import { describe, expect, test } from "bun:test";
import { buildArticleIdentity, normalizeArticleUrl } from "./article-identity";

describe("article identity", () => {
  test("removes hash and common tracking params", () => {
    expect(
      normalizeArticleUrl(
        "https://Example.com/posts/hello/?utm_source=newsletter&keep=1&fbclid=abc#comments",
      ),
    ).toBe("https://example.com/posts/hello?keep=1");
  });

  test("normalizes trailing slash variants", () => {
    expect(normalizeArticleUrl("https://example.com/posts/hello/")).toBe(
      "https://example.com/posts/hello",
    );
  });

  test("keeps feed scope in article identity", () => {
    const url = "https://example.com/posts/hello/?utm_medium=rss";

    expect(buildArticleIdentity("feed-a", url)).toBe("feed-a|https://example.com/posts/hello");
    expect(buildArticleIdentity("feed-b", url)).toBe("feed-b|https://example.com/posts/hello");
  });
});
