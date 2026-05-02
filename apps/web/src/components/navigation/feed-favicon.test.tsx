import { buildFaviconUrl, buildFaviconUrlCandidates } from "./feed-favicon";
import { describe, expect, test } from "vitest";

describe("buildFaviconUrl", () => {
  test("prefers stored favicon URL over proxy fallback", () => {
    const url = buildFaviconUrl(
      "https://cdn.example.com/icon.png",
      "https://example.com",
      "https://example.com/feed.xml",
    );
    expect(url).toBe("https://cdn.example.com/icon.png");
  });

  test("falls back to favicon proxy when stored metadata is missing", () => {
    const url = buildFaviconUrl(null, "https://example.com/posts", "https://example.com/feed.xml");
    expect(url).toBe("/api/favicon?domain=https%3A%2F%2Fexample.com&v=2");
  });

  test("rejects non-http/https feed URLs (no proxy for data:/file: URIs)", () => {
    const url = buildFaviconUrl(null, null, "file:///etc/hosts");
    expect(url).toBeNull();
  });

  test("prioritizes stored favicon URL before proxy fallback", () => {
    const urls = buildFaviconUrlCandidates(
      "https://cdn.example.com/icon.png",
      "https://example.com/posts",
      "https://example.com/feed.xml",
    );

    expect(urls).toEqual([
      "https://cdn.example.com/icon.png",
      "/api/favicon?domain=https%3A%2F%2Fexample.com&v=2",
      "https://example.com/favicon.ico",
    ]);
  });

  test("includes direct-origin favicon fallback when stored metadata is missing", () => {
    const urls = buildFaviconUrlCandidates(null, "https://techcrunch.com/news", "https://rss.tc");
    expect(urls).toEqual([
      "/api/favicon?domain=https%3A%2F%2Ftechcrunch.com&v=2",
      "https://techcrunch.com/favicon.ico",
    ]);
  });
});
