import { buildFaviconUrl } from "./feed-favicon";
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
    expect(url).toBe("/api/favicon?domain=https%3A%2F%2Fexample.com");
  });

  test("rejects non-http/https feed URLs (no proxy for data:/file: URIs)", () => {
    const url = buildFaviconUrl(null, null, "file:///etc/hosts");
    expect(url).toBeNull();
  });
});
