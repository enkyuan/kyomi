import { buildClientFaviconUrl } from "@kyomi/worker/favicon/browser";
import { buildFaviconUrlCandidates } from "@modules/sidebar/lib/favicon";
import { SourceRow } from "@modules/feeds/components/item/source-row";
import { FeedFavicon } from "@modules/sidebar/components/feed-favicon";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

describe("feed favicons", () => {
  test("prefers stored favicon URL over proxy fallback", () => {
    const url = buildClientFaviconUrl(
      "https://cdn.example.com/icon.png",
      "https://example.com",
      "https://example.com/feed.xml",
    );
    expect(url).toBe("https://cdn.example.com/icon.png");
  });

  test("falls back to favicon proxy when stored metadata is missing", () => {
    const url = buildClientFaviconUrl(
      null,
      "https://example.com/posts",
      "https://example.com/feed.xml",
    );
    expect(url).toBe("/api/favicon?domain=https%3A%2F%2Fexample.com&v=4");
  });

  test("rejects non-http/https feed URLs (no proxy for data:/file: URIs)", () => {
    const url = buildClientFaviconUrl(null, null, "file:///etc/hosts");
    expect(url).toBeNull();
  });

  test("prioritizes the high-resolution proxy before stored favicon metadata", () => {
    const urls = buildFaviconUrlCandidates(
      "https://cdn.example.com/icon.png",
      "https://example.com/posts",
      "https://example.com/feed.xml",
    );

    expect(urls).toEqual([
      "/api/favicon?domain=https%3A%2F%2Fexample.com&v=4",
      "https://cdn.example.com/icon.png",
      "https://example.com/favicon.ico",
    ]);
  });

  test("includes direct-origin favicon fallback when stored metadata is missing", () => {
    const urls = buildFaviconUrlCandidates(null, "https://techcrunch.com/news", "https://rss.tc");
    expect(urls).toEqual([
      "/api/favicon?domain=https%3A%2F%2Ftechcrunch.com&v=4",
      "https://techcrunch.com/favicon.ico",
    ]);
  });

  test("uses feed origin when site URL is unavailable", () => {
    const urls = buildFaviconUrlCandidates(null, null, "https://feeds.techcrunch.com/rss.xml");
    expect(urls).toEqual([
      "/api/favicon?domain=https%3A%2F%2Ffeeds.techcrunch.com&v=4",
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
      "/api/favicon?domain=https%3A%2F%2Ftechcrunch.com&v=4",
    );

    fireEvent.error(proxyImg);
    const directImg = screen.getByRole("img", { name: "TechCrunch favicon" });
    expect(directImg.getAttribute("src")).toBe("https://techcrunch.com/favicon.ico");

    fireEvent.error(directImg);
    expect(screen.queryByRole("img", { name: "TechCrunch favicon" })).toBeNull();
    expect(screen.getByLabelText("TechCrunch feed")).not.toBeNull();
  });

  test("keeps a loaded low-resolution favicon when no higher-resolution candidate works", () => {
    render(
      <FeedFavicon
        faviconUrl={null}
        feedUrl="https://feeds.techcrunch.com/rss.xml"
        siteUrl="https://techcrunch.com/article"
        title="TechCrunch"
      />,
    );

    const proxyImg = screen.getByRole("img", { name: "TechCrunch favicon" });
    Object.defineProperty(proxyImg, "naturalWidth", { configurable: true, value: 16 });
    Object.defineProperty(proxyImg, "naturalHeight", { configurable: true, value: 16 });
    fireEvent.load(proxyImg);

    const directImg = screen.getByRole("img", { name: "TechCrunch favicon" });
    expect(directImg.getAttribute("src")).toBe("https://techcrunch.com/favicon.ico");

    Object.defineProperty(directImg, "naturalWidth", { configurable: true, value: 16 });
    Object.defineProperty(directImg, "naturalHeight", { configurable: true, value: 16 });
    fireEvent.load(directImg);

    expect(screen.getByRole("img", { name: "TechCrunch favicon" }).getAttribute("src")).toBe(
      "/api/favicon?domain=https%3A%2F%2Ftechcrunch.com&v=4",
    );
    expect(screen.queryByLabelText("TechCrunch feed")).toBeNull();
  });

  test("tries the high-resolution proxy before persisted feed favicon metadata", () => {
    render(
      <FeedFavicon
        faviconUrl="https://cdn.techcrunch.example/icon.png"
        feedUrl="https://feeds.techcrunch.example/rss.xml"
        siteUrl="https://fresh.techcrunch.example/article"
        title="TechCrunch"
      />,
    );

    const proxyImg = screen.getByRole("img", { name: "TechCrunch favicon" });
    expect(proxyImg.getAttribute("src")).toBe(
      "/api/favicon?domain=https%3A%2F%2Ffresh.techcrunch.example&v=4",
    );

    fireEvent.error(proxyImg);
    const storedImg = screen.getByRole("img", { name: "TechCrunch favicon" });
    expect(storedImg.getAttribute("src")).toBe("https://cdn.techcrunch.example/icon.png");
  });

  test("keeps scalable SVG favicons even when their intrinsic size is small", () => {
    render(
      <FeedFavicon
        faviconUrl="https://news.ycombinator.com/y18.svg"
        feedUrl="https://news.ycombinator.com/rss"
        siteUrl="https://news.ycombinator.com"
        title="Hacker News"
      />,
    );

    const storedImg = screen.getByRole("img", { name: "Hacker News favicon" });
    Object.defineProperty(storedImg, "naturalWidth", { configurable: true, value: 18 });
    Object.defineProperty(storedImg, "naturalHeight", { configurable: true, value: 18 });
    fireEvent.load(storedImg);

    expect(screen.getByRole("img", { name: "Hacker News favicon" }).getAttribute("src")).toBe(
      "https://news.ycombinator.com/y18.svg",
    );
  });

  test("source rows fall back through feed origin instead of article origin", () => {
    render(
      <SourceRow
        articleUrl="https://en.wikipedia.org/wiki/Forestiere_Underground_Gardens"
        feedFaviconUrl="https://news.ycombinator.com/y18.svg"
        feedSiteUrl="https://news.ycombinator.com"
        feedTitle="Hacker News"
        feedUrl="https://news.ycombinator.com/rss"
        enablePreview={false}
      />,
    );

    const proxyImg = screen.getByRole("img", { name: "Hacker News favicon" });
    expect(proxyImg.getAttribute("src")).toBe(
      "/api/favicon?domain=https%3A%2F%2Fnews.ycombinator.com&v=4",
    );

    fireEvent.error(proxyImg);
    expect(screen.getByRole("img", { name: "Hacker News favicon" }).getAttribute("src")).toBe(
      "https://news.ycombinator.com/y18.svg",
    );
  });
});
