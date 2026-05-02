import { buildFaviconUrl, buildFaviconUrlCandidates } from "@components/navigation/feed-favicon";
import { FeedFavicon } from "@components/navigation/feed-favicon";
import { fireEvent, render, screen } from "@testing-library/react";
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

  test("uses feed origin when site URL is unavailable", () => {
    const urls = buildFaviconUrlCandidates(null, null, "https://feeds.techcrunch.com/rss.xml");
    expect(urls).toEqual([
      "/api/favicon?domain=https%3A%2F%2Ffeeds.techcrunch.com&v=2",
      "https://feeds.techcrunch.com/favicon.ico",
    ]);
  });

  test("falls back from proxy to direct favicon and then RSS icon", () => {
    render(
      <FeedFavicon
        faviconUrl={null}
        feedUrl="https://feeds.techcrunch.com/rss.xml"
        siteUrl="https://techcrunch.com/article"
        title="TechCrunch"
      />,
    );

    const proxyImg = screen.getByRole("img", { name: "TechCrunch favicon" });
    expect(proxyImg.getAttribute("src")).toBe(
      "/api/favicon?domain=https%3A%2F%2Ftechcrunch.com&v=2",
    );

    fireEvent.error(proxyImg);
    const directImg = screen.getByRole("img", { name: "TechCrunch favicon" });
    expect(directImg.getAttribute("src")).toBe("https://techcrunch.com/favicon.ico");

    fireEvent.error(directImg);
    expect(screen.queryByRole("img", { name: "TechCrunch favicon" })).toBeNull();
    expect(screen.getByLabelText("TechCrunch feed")).not.toBeNull();
  });

  test("falls back from persisted feed favicon to proxy", () => {
    render(
      <FeedFavicon
        faviconUrl="https://cdn.techcrunch.example/icon.png"
        feedUrl="https://feeds.techcrunch.example/rss.xml"
        siteUrl="https://fresh.techcrunch.example/article"
        title="TechCrunch"
      />,
    );

    const storedImg = screen.getByRole("img", { name: "TechCrunch favicon" });
    expect(storedImg.getAttribute("src")).toBe("https://cdn.techcrunch.example/icon.png");

    fireEvent.error(storedImg);
    const proxyImg = screen.getByRole("img", { name: "TechCrunch favicon" });
    expect(proxyImg.getAttribute("src")).toBe(
      "/api/favicon?domain=https%3A%2F%2Ffresh.techcrunch.example&v=2",
    );
  });
});
